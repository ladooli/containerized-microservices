CREATE TABLE IF NOT EXISTS items (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO items (name, description) VALUES
  ('Alpha item',  'First item served by the storage service'),
  ('Beta item',   'Second item served by the storage service'),
  ('Gamma item',  'Third item served by the storage service');
