# Test Templates System - Implementation Summary

## Overview

This document describes the implementation of a comprehensive **Test Template System** for OpenCCB, allowing instructors to create and reuse test/quiz templates based on:

1. **Course Level**: `beginner`, `beginner_1`, `beginner_2`, `intermediate`, `advanced`, etc.
2. **Course Type**: `intensive` or `regular`
3. **Assessment Type**: `CA`, `MWT`, `MOT`, `FOT`, `FWT`

## Database Changes

### New Enums

```sql
-- Course levels
CREATE TYPE course_level AS ENUM (
    'beginner', 'beginner_1', 'beginner_2',
    'intermediate', 'intermediate_1', 'intermediate_2',
    'advanced', 'advanced_1', 'advanced_2'
);

-- Course types
CREATE TYPE course_type AS ENUM ('intensive', 'regular');

-- Test types (assessment types)
CREATE TYPE test_type AS ENUM ('CA', 'MWT', 'MOT', 'FOT', 'FWT');
```

### New Tables

#### `test_templates`
Main table for storing test templates with metadata:
- `id`: UUID primary key
- `organization_id`: Multi-tenancy support
- `name`, `description`: Template identification
- `level`, `course_type`, `test_type`: Classification enums
- `duration_minutes`, `passing_score`, `total_points`: Configuration
- `instructions`: General test instructions
- `template_data`: JSONB with complete test structure
- `tags`: Text array for categorization
- `usage_count`: Tracks template popularity
- `is_active`: Soft delete support

#### `test_template_sections`
Optional sections within a test (e.g., "Reading", "Grammar", "Listening"):
- `template_id`: Foreign key to `test_templates`
- `section_order`: Ordering within template
- `points`, `instructions`: Section-specific config
- `section_data`: JSONB for advanced configuration

#### `test_template_questions`
Individual questions for each template:
- `template_id`, `section_id`: Foreign keys
- `question_order`: Ordering
- `question_type`: "multiple-choice", "true-false", "short-answer", "essay", "matching", "ordering"
- `question_text`, `options`, `correct_answer`, `explanation`: Question content
- `points`, `metadata`: Scoring and additional data

### Database Functions

- `get_test_templates_by_filters()`: Filter templates by level, type, test type, and search
- `increment_template_usage()`: Track template usage statistics

### Course Model Updates

Added optional fields to `courses` table:
- `level`: Course level enum
- `course_type`: Course type enum

## Backend Implementation

### Models (`shared/common/src/models.rs`)

New Rust structs:
- `CourseLevel`, `CourseType`, `TestType`: Enum types
- `TestTemplate`, `TestTemplateSection`, `TestTemplateQuestion`: Main models
- `CreateTestTemplatePayload`, `UpdateTestTemplatePayload`: Request/Response DTOs
- `TestTemplateWithQuestions`: Composite response type

### API Handlers (`services/cms-service/src/handlers_test_templates.rs`)

RESTful endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/test-templates` | List templates with filters |
| POST | `/test-templates` | Create new template |
| GET | `/test-templates/{id}` | Get template with questions |
| PUT | `/test-templates/{id}` | Update template |
| DELETE | `/test-templates/{id}` | Delete template |
| POST | `/test-templates/{id}/questions` | Add question |
| DELETE | `/test-templates/{id}/questions/{qid}` | Delete question |
| POST | `/test-templates/{id}/sections` | Add section |
| DELETE | `/test-templates/{id}/sections/{sid}` | Delete section |
| POST | `/test-templates/{id}/apply` | Apply template to lesson |

### Routes (`services/cms-service/src/main.rs`)

All routes are protected and require organization context.

## Frontend Implementation

### TypeScript Types (`web/studio/src/lib/api.ts`)

```typescript
type CourseLevel = 'beginner' | 'beginner_1' | ... | 'advanced_2';
type CourseType = 'intensive' | 'regular';
type TestType = 'CA' | 'MWT' | 'MOT' | 'FOT' | 'FWT';
type QuestionType = 'multiple-choice' | 'true-false' | ...;

interface TestTemplate { ... }
interface TestTemplateSection { ... }
interface TestTemplateQuestion { ... }
interface CreateTestTemplatePayload { ... }
```

### API Functions (`cmsApi` object)

- `listTestTemplates(filters)`
- `getTestTemplate(templateId)`
- `createTestTemplate(payload)`
- `updateTestTemplate(templateId, payload)`
- `deleteTestTemplate(templateId)`
- `createTemplateQuestion(templateId, payload)`
- `deleteTemplateQuestion(templateId, questionId)`
- `createTemplateSection(templateId, payload)`
- `deleteTemplateSection(templateId, sectionId)`
- `applyTemplateToLesson(templateId, lessonId, gradingCategoryId)`

### UI Components

#### `TestTemplateManager` (`web/studio/src/components/TestTemplates/TestTemplateManager.tsx`)

Main management interface with:
- Grid view of templates
- Search functionality
- Advanced filters (level, course type, test type)
- Template cards showing:
  - Name, description
  - Level, type badges with color coding
  - Duration, passing score, total points
  - Tags
  - Usage statistics
  - Action buttons (view, edit, delete, apply)

#### `TestTemplateForm` (`web/studio/src/components/TestTemplates/TestTemplateForm.tsx`)

Modal form for creating/editing templates with:
- Basic info (name, description)
- Classification (level, course type, test type)
- Configuration (duration, passing score, total points)
- Instructions
- Tag management

#### Page (`web/studio/src/app/test-templates/page.tsx`)

Dedicated page at `/test-templates` route.

## Usage Examples

### Creating a Template via API

```bash
curl -X POST http://localhost:3001/test-templates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Organization-Id: YOUR_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Final Exam - Beginner 1",
    "description": "Comprehensive final exam for beginner level",
    "level": "beginner_1",
    "course_type": "regular",
    "test_type": "FWT",
    "duration_minutes": 90,
    "passing_score": 70,
    "total_points": 100,
    "instructions": "Answer all questions. You have 90 minutes.",
    "tags": ["final", "beginner", "written"]
  }'
```

### Filtering Templates

```bash
# Get all FOT templates for beginner intensive courses
curl "http://localhost:3001/test-templates?level=beginner_1&course_type=intensive&test_type=FOT" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Applying Template to a Lesson

```bash
curl -X POST http://localhost:3001/test-templates/TEMPLATE_ID/apply \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Organization-Id: YOUR_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "lesson_id": "LESSON_ID",
    "grading_category_id": "CATEGORY_ID"
  }'
```

## Migration

Run the migration to set up the database schema:

```bash
cd services/cms-service
sqlx migrate run --source migrations
```

The migration file is: `20260316000000_test_templates.sql`

## Future Enhancements

1. **Template Cloning**: Allow duplicating existing templates
2. **Question Bank**: Centralized repository of questions that can be mixed and matched
3. **Template Sharing**: Share templates across organizations
4. **Analytics**: Track template effectiveness and student performance
5. **AI Generation**: Auto-generate templates based on course content
6. **Version Control**: Track template revisions
7. **Bulk Operations**: Apply templates to multiple lessons at once
8. **Preview Mode**: Preview template before applying

## File Structure

```
openccb/
├── shared/common/src/models.rs          # Rust models
├── services/cms-service/
│   ├── migrations/20260316000000_test_templates.sql
│   ├── src/handlers_test_templates.rs   # API handlers
│   └── src/main.rs                       # Routes
└── web/studio/
    ├── src/lib/api.ts                    # TypeScript types & API functions
    ├── src/components/TestTemplates/
    │   ├── TestTemplateManager.tsx
    │   ├── TestTemplateForm.tsx
    │   └── index.ts
    └── src/app/test-templates/
        └── page.tsx
```

## Testing

### Backend Tests

```bash
cargo test -p common
cargo test -p cms-service
```

### Frontend Type Check

```bash
cd web/studio
npm run type-check
```

## Notes

- All templates are organization-scoped for multi-tenancy
- Soft delete via `is_active` flag preserves historical data
- Usage count helps identify popular templates
- JSONB fields provide flexibility for evolving question types
- The system integrates with existing grading categories via `tipo_nota` catalog
