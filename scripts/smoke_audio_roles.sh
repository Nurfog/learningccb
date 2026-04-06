#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="openccb-db"
DB_NAME="openccb_lms"
DB_USER="user"
API_RUNNER_CONTAINER="${API_RUNNER_CONTAINER:-openccb-studio}"
INTERNAL_BASE_URL="${INTERNAL_BASE_URL:-http://experience:3002}"

JWT_SECRET="${JWT_SECRET:-}"
if [[ -z "$JWT_SECRET" ]]; then
  if [[ -f .env ]]; then
    JWT_SECRET="$(grep -E '^JWT_SECRET=' .env | head -n1 | cut -d'=' -f2-)"
  fi
fi

if [[ -z "$JWT_SECRET" ]]; then
  echo "ERROR: JWT_SECRET not found (env or .env)"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required"
  exit 1
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl is required"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is required"
  exit 1
fi

b64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

make_jwt() {
  local user_id="$1"
  local org_id="$2"
  local role="$3"
  local now exp header payload header_b64 payload_b64 signature

  now="$(date +%s)"
  exp="$((now + 86400))"

  header='{"alg":"HS256","typ":"JWT"}'
  payload="$(jq -cn \
    --arg sub "$user_id" \
    --arg org "$org_id" \
    --arg role "$role" \
    --argjson exp "$exp" \
    '{sub:$sub,org:$org,exp:$exp,role:$role,course_id:null,token_type:"access"}')"

  header_b64="$(printf '%s' "$header" | b64url)"
  payload_b64="$(printf '%s' "$payload" | b64url)"
  signature="$(printf '%s' "${header_b64}.${payload_b64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url)"

  printf '%s.%s.%s' "$header_b64" "$payload_b64" "$signature"
}

run_sql() {
  local sql="$1"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -t -A -c "$sql"
}

check_http() {
  local label="$1"
  local expected="$2"
  local token="$3"
  local path="$4"
  local method="${5:-GET}"
  local body="${6:-}"

  local response
  response="$(docker exec \
    -e TARGET_URL="${INTERNAL_BASE_URL}${path}" \
    -e METHOD="$method" \
    -e TOKEN="$token" \
    -e ORG_ID="$ORG_ID" \
    -e REQ_BODY="$body" \
    "$API_RUNNER_CONTAINER" \
    node -e "
const url = process.env.TARGET_URL;
const method = process.env.METHOD || 'GET';
const token = process.env.TOKEN;
const orgId = process.env.ORG_ID;
const body = process.env.REQ_BODY || '';

const headers = {
  'Authorization': 'Bearer ' + token,
  'X-Organization-Id': orgId,
};

const init = { method, headers };
if (body) {
  headers['Content-Type'] = 'application/json';
  init.body = body;
}

fetch(url, init)
  .then(async (res) => {
    const text = await res.text();
    process.stdout.write(String(res.status) + '\n');
    process.stdout.write(text);
  })
  .catch((err) => {
    console.error('FETCH_ERROR:' + err.message);
    process.exit(2);
  });
")"

  local code
  code="$(printf '%s' "$response" | head -n1)"
  local response_body
  response_body="$(printf '%s' "$response" | tail -n +2)"

  local ok="0"
  IFS='|' read -r -a expected_codes <<< "$expected"
  for ec in "${expected_codes[@]}"; do
    if [[ "$code" == "$ec" ]]; then
      ok="1"
      break
    fi
  done

  if [[ "$ok" == "1" ]]; then
    echo "PASS [$label] -> HTTP $code"
  else
    echo "FAIL [$label] -> expected $expected, got $code"
    echo "Response body:"
    printf '%s\n' "$response_body"
    return 1
  fi
}

cleanup() {
  if [[ "${KEEP_FIXTURES:-0}" == "1" ]]; then
    echo "KEEP_FIXTURES=1 -> skipping cleanup for debugging"
    return
  fi
  run_sql "DELETE FROM audio_responses WHERE id IN ('${RESP_A_ID}', '${RESP_B_ID}');" >/dev/null || true
  run_sql "DELETE FROM course_instructors WHERE course_id IN ('${COURSE_A_ID}', '${COURSE_B_ID}') AND user_id='${INSTRUCTOR_ID}';" >/dev/null || true
  run_sql "DELETE FROM lessons WHERE id IN ('${LESSON_A_ID}', '${LESSON_B_ID}');" >/dev/null || true
  run_sql "DELETE FROM modules WHERE id IN ('${MODULE_A_ID}', '${MODULE_B_ID}');" >/dev/null || true
  run_sql "DELETE FROM courses WHERE id IN ('${COURSE_A_ID}', '${COURSE_B_ID}');" >/dev/null || true
  run_sql "DELETE FROM users WHERE id IN ('${ADMIN_ID}', '${INSTRUCTOR_ID}', '${STUDENT_OWNER_ID}', '${STUDENT_OTHER_ID}');" >/dev/null || true
}
trap cleanup EXIT

ORG_ID="00000000-0000-0000-0000-000000000001"
ADMIN_ID="$(cat /proc/sys/kernel/random/uuid)"
INSTRUCTOR_ID="$(cat /proc/sys/kernel/random/uuid)"
STUDENT_OWNER_ID="$(cat /proc/sys/kernel/random/uuid)"
STUDENT_OTHER_ID="$(cat /proc/sys/kernel/random/uuid)"
COURSE_A_ID="$(cat /proc/sys/kernel/random/uuid)"
COURSE_B_ID="$(cat /proc/sys/kernel/random/uuid)"
MODULE_A_ID="$(cat /proc/sys/kernel/random/uuid)"
MODULE_B_ID="$(cat /proc/sys/kernel/random/uuid)"
LESSON_A_ID="$(cat /proc/sys/kernel/random/uuid)"
LESSON_B_ID="$(cat /proc/sys/kernel/random/uuid)"
BLOCK_A_ID="$(cat /proc/sys/kernel/random/uuid)"
BLOCK_B_ID="$(cat /proc/sys/kernel/random/uuid)"
RESP_A_ID="$(cat /proc/sys/kernel/random/uuid)"
RESP_B_ID="$(cat /proc/sys/kernel/random/uuid)"

SUFFIX="$(date +%s)"

echo "Creating temporary LMS fixtures..."
echo "ORG_ID=${ORG_ID}"
echo "RESP_A_ID=${RESP_A_ID}"
echo "RESP_B_ID=${RESP_B_ID}"
run_sql "
INSERT INTO organizations (id, name)
VALUES ('${ORG_ID}', 'OpenCCB Default Org')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, full_name, role, organization_id)
VALUES
  ('${ADMIN_ID}', 'smoke-admin-${SUFFIX}@local.test', 'x', 'Smoke Admin', 'admin', '${ORG_ID}'),
  ('${INSTRUCTOR_ID}', 'smoke-instructor-${SUFFIX}@local.test', 'x', 'Smoke Instructor', 'instructor', '${ORG_ID}'),
  ('${STUDENT_OWNER_ID}', 'smoke-student-owner-${SUFFIX}@local.test', 'x', 'Smoke Student Owner', 'student', '${ORG_ID}'),
  ('${STUDENT_OTHER_ID}', 'smoke-student-other-${SUFFIX}@local.test', 'x', 'Smoke Student Other', 'student', '${ORG_ID}');

INSERT INTO courses (id, title, description, instructor_id, organization_id)
VALUES
  ('${COURSE_A_ID}', 'Smoke Course A', 'Course with instructor access', '${INSTRUCTOR_ID}', '${ORG_ID}'),
  ('${COURSE_B_ID}', 'Smoke Course B', 'Course without instructor access', '${ADMIN_ID}', '${ORG_ID}');

INSERT INTO modules (id, course_id, title, position, organization_id)
VALUES
  ('${MODULE_A_ID}', '${COURSE_A_ID}', 'Module A', 1, '${ORG_ID}'),
  ('${MODULE_B_ID}', '${COURSE_B_ID}', 'Module B', 1, '${ORG_ID}');

INSERT INTO lessons (id, module_id, title, content_type, position, organization_id)
VALUES
  ('${LESSON_A_ID}', '${MODULE_A_ID}', 'Lesson A', 'video', 1, '${ORG_ID}'),
  ('${LESSON_B_ID}', '${MODULE_B_ID}', 'Lesson B', 'video', 1, '${ORG_ID}');

INSERT INTO course_instructors (organization_id, course_id, user_id, role)
VALUES
  ('${ORG_ID}', '${COURSE_A_ID}', '${INSTRUCTOR_ID}', 'instructor');

INSERT INTO audio_responses (
  id, organization_id, user_id, course_id, lesson_id, block_id, prompt,
  transcript, audio_data, ai_score, ai_found_keywords, ai_feedback, ai_evaluated_at,
  status, attempt_number, duration_seconds
)
VALUES
  (
    '${RESP_A_ID}', '${ORG_ID}', '${STUDENT_OWNER_ID}', '${COURSE_A_ID}', '${LESSON_A_ID}', '${BLOCK_A_ID}',
    'Prompt A', 'Transcript A', convert_to('aGVsbG8=', 'UTF8'), 80, ARRAY['keyword'], 'good', now(),
    'ai_evaluated', 1, 12
  ),
  (
    '${RESP_B_ID}', '${ORG_ID}', '${STUDENT_OWNER_ID}', '${COURSE_B_ID}', '${LESSON_B_ID}', '${BLOCK_B_ID}',
    'Prompt B', 'Transcript B', convert_to('aGVsbG8=', 'UTF8'), 75, ARRAY['keyword'], 'pending review', now(),
    'pending', 1, 11
  );
" >/dev/null

echo "Generating role tokens..."
ADMIN_TOKEN="$(make_jwt "$ADMIN_ID" "$ORG_ID" "admin")"
INSTRUCTOR_TOKEN="$(make_jwt "$INSTRUCTOR_ID" "$ORG_ID" "instructor")"
OWNER_STUDENT_TOKEN="$(make_jwt "$STUDENT_OWNER_ID" "$ORG_ID" "student")"
OTHER_STUDENT_TOKEN="$(make_jwt "$STUDENT_OTHER_ID" "$ORG_ID" "student")"

echo "Running role-based smoke checks..."
check_http "admin pending_instructor list" "200" "$ADMIN_TOKEN" "/audio-responses?status=pending_instructor"
check_http "instructor list scoped" "200" "$INSTRUCTOR_TOKEN" "/audio-responses"
check_http "instructor forbidden detail out-of-course" "403|404" "$INSTRUCTOR_TOKEN" "/audio-responses/${RESP_B_ID}"
check_http "owner student audio access" "200" "$OWNER_STUDENT_TOKEN" "/audio-responses/${RESP_A_ID}/audio"
check_http "other student denied audio access" "403" "$OTHER_STUDENT_TOKEN" "/audio-responses/${RESP_A_ID}/audio"
check_http "instructor evaluate in-course" "200" "$INSTRUCTOR_TOKEN" "/audio-responses/${RESP_A_ID}/evaluate" "POST" '{"teacher_score":90,"teacher_feedback":"ok"}'
check_http "instructor denied evaluate out-of-course" "403" "$INSTRUCTOR_TOKEN" "/audio-responses/${RESP_B_ID}/evaluate" "POST" '{"teacher_score":70,"teacher_feedback":"n/a"}'
check_http "admin stats course A" "200" "$ADMIN_TOKEN" "/courses/${COURSE_A_ID}/audio-responses/stats"
check_http "instructor denied stats course B" "403" "$INSTRUCTOR_TOKEN" "/courses/${COURSE_B_ID}/audio-responses/stats"

echo "All smoke checks passed."
