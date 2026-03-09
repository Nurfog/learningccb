-- Migration: Enforce single-tenant and update organization name
-- This migration updates fn_register_user to always use the default organization ID (0...1)
-- but allows updating its name during the initial registration.

CREATE OR REPLACE FUNCTION fn_register_user(
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_full_name VARCHAR(255),
    p_role VARCHAR(50),
    p_org_name VARCHAR(255) DEFAULT NULL
) RETURNS SETOF users AS $$
DECLARE
    v_org_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Update the default organization name if a custom name is provided
    IF p_org_name IS NOT NULL AND p_org_name <> '' AND p_org_name <> 'Default Organization' AND p_org_name <> 'Organización por Defecto' THEN
        UPDATE organizations 
        SET name = p_org_name, 
            updated_at = NOW() 
        WHERE id = v_org_id;
    END IF;

    -- Create user and assign to the default organization
    RETURN QUERY
    INSERT INTO users (email, password_hash, full_name, role, organization_id)
    VALUES (p_email, p_password_hash, p_full_name, p_role, v_org_id)
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
