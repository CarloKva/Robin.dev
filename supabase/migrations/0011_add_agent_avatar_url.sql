-- =============================================================================
-- Migration 0011 · Add avatar_url to agents table
-- =============================================================================
-- Adds a nullable avatar_url column so agents can store an image URL
-- (sourced from Jikan anime character API or Dicebear fallback).
-- =============================================================================

ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_url text;
