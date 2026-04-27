-- ============================================================
-- Edition Demo Seed Data
-- Creates fake users, profiles, posts, blocks, and follows
-- ============================================================

-- ============================================================
-- 1. Create auth users (bypassing the trigger for profiles)
-- ============================================================

-- We insert directly into auth.users with known UUIDs for reproducibility
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maya@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "maya", "display_name": "Maya Chen"}', now() - interval '60 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jordan@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "jordan", "display_name": "Jordan Rivera"}', now() - interval '55 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "samwise", "display_name": "Sam Nakamura"}', now() - interval '50 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "priya", "display_name": "Priya Sharma"}', now() - interval '45 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alex@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "alexk", "display_name": "Alex Kim"}', now() - interval '40 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'luna@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "luna", "display_name": "Luna Morales"}', now() - interval '35 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'omar@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "omar", "display_name": "Omar Hassan"}', now() - interval '30 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zoe@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "zoe", "display_name": "Zoë Williams"}', now() - interval '25 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kai@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "kai", "display_name": "Kai Tanaka"}', now() - interval '20 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'elena@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "elena", "display_name": "Elena Volkov"}', now() - interval '15 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "demo", "display_name": "Demo User"}', now() - interval '60 days', now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'liam@demo.com', crypt('password123', gen_salt('bf')), now(), '{"username": "liam", "display_name": "Liam O''Brien"}', now() - interval '10 days', now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Also insert identities so login works
INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'email', '{"sub": "a0000000-0000-0000-0000-000000000001", "email": "maya@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'email', '{"sub": "a0000000-0000-0000-0000-000000000002", "email": "jordan@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'email', '{"sub": "a0000000-0000-0000-0000-000000000003", "email": "sam@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'email', '{"sub": "a0000000-0000-0000-0000-000000000004", "email": "priya@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'email', '{"sub": "a0000000-0000-0000-0000-000000000005", "email": "alex@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'email', '{"sub": "a0000000-0000-0000-0000-000000000006", "email": "luna@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000007', 'email', '{"sub": "a0000000-0000-0000-0000-000000000007", "email": "omar@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', 'email', '{"sub": "a0000000-0000-0000-0000-000000000008", "email": "zoe@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'email', '{"sub": "a0000000-0000-0000-0000-000000000009", "email": "kai@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', 'email', '{"sub": "a0000000-0000-0000-0000-000000000010", "email": "elena@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', 'email', '{"sub": "a0000000-0000-0000-0000-000000000011", "email": "demo@demo.com"}', now(), now(), now()),
  ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000012', 'email', '{"sub": "a0000000-0000-0000-0000-000000000012", "email": "liam@demo.com"}', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Profiles (trigger should create these, but insert manually to be safe)
-- ============================================================

INSERT INTO public.profiles (id, username, display_name, bio, is_public, streak_count)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'maya',    'Maya Chen',       'Designer & illustrator based in Portland. Documenting my creative journey one week at a time.', true,  8),
  ('a0000000-0000-0000-0000-000000000002', 'jordan',  'Jordan Rivera',   'Software engineer. Trail runner. Questionable cook. This is my weekly brain dump.', true,  5),
  ('a0000000-0000-0000-0000-000000000003', 'samwise', 'Sam Nakamura',    'PhD student in marine biology. I write about the ocean and everything in it.', true,  12),
  ('a0000000-0000-0000-0000-000000000004', 'priya',   'Priya Sharma',    'Product manager by day, amateur photographer by weekend. Currently in Tokyo.', true,  3),
  ('a0000000-0000-0000-0000-000000000005', 'alexk',   'Alex Kim',        'Musician and music teacher. Sharing what I listen to and what I learn.', false, 6),
  ('a0000000-0000-0000-0000-000000000006', 'luna',    'Luna Morales',    'Freelance writer. Cat mom. Obsessed with coffee and bookshops.', true,  10),
  ('a0000000-0000-0000-0000-000000000007', 'omar',    'Omar Hassan',     'Architect exploring the intersection of sustainability and urban design.', true,  4),
  ('a0000000-0000-0000-0000-000000000008', 'zoe',     'Zoë Williams',    'Graduate student. Rock climbing. Board games. Sourdough attempts.', true,  7),
  ('a0000000-0000-0000-0000-000000000009', 'kai',     'Kai Tanaka',      'Filmmaker and visual storyteller. Currently working on a short documentary.', true,  2),
  ('a0000000-0000-0000-0000-000000000010', 'elena',   'Elena Volkov',    'Data scientist who writes about statistics, books, and life in Berlin.', true,  9),
  ('a0000000-0000-0000-0000-000000000011', 'demo',    'Demo User',       'This is the demo account. Log in with demo@demo.com / password123', true,  4),
  ('a0000000-0000-0000-0000-000000000012', 'liam',    'Liam O''Brien',   'Barista and aspiring novelist. Weekly dispatches from behind the counter.', true,  1)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  bio = EXCLUDED.bio,
  is_public = EXCLUDED.is_public,
  streak_count = EXCLUDED.streak_count;

-- ============================================================
-- 3. Follow graph (demo user follows most people, others follow each other)
-- ============================================================

INSERT INTO public.follows (follower_id, following_id) VALUES
  -- Demo follows everyone
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000007'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000008'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000009'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000010'),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000012'),
  -- Various cross-follows
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000010'),
  ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007'),
  ('a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000008'),
  ('a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000011'),
  ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000006'),
  ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000011')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Posts — spread across current week and past weeks
-- ============================================================

-- Helper: get current ISO week
DO $$
DECLARE
  cw int := extract(week from now());
  cy int := extract(isoyear from now());
BEGIN

-- Current week posts (these are what you'd see in the feed if unlocked)
INSERT INTO public.posts (id, user_id, week_number, year, title, is_published, is_late, word_count, cover_color, tags, published_at, created_at)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', cw, cy, 'Portland Rain and Pixel Art', true, false, 247, '#4a7c59', '{design,portland,art}', now() - interval '2 days', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', cw, cy, 'Debugging at 2AM: A Love Story', true, false, 312, '#fb5012', '{coding,life}', now() - interval '1 day', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', cw, cy, 'Whale Songs and Water Pressure', true, false, 189, '#659dbd', '{ocean,research,biology}', now() - interval '3 days', now() - interval '4 days'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', cw, cy, 'Five Books I Read This Week', true, false, 423, '#c38d9e', '{books,reading}', now() - interval '1 day', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000008', cw, cy, 'My Sourdough Finally Didn''t Collapse', true, false, 178, '#e8a87c', '{baking,food}', now() - interval '12 hours', now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000010', cw, cy, 'Berlin Streets in April', true, false, 265, '#223843', '{berlin,photography}', now() - interval '2 days', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000011', cw, cy, 'Demo Post: Welcome to Edition', true, false, 156, '#6b5b95', '{welcome,demo}', now() - interval '1 day', now() - interval '1 day');

-- Last week posts (archive)
INSERT INTO public.posts (id, user_id, week_number, year, title, is_published, is_late, word_count, cover_color, tags, published_at, created_at)
VALUES
  ('b0000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000001', cw-1, cy, 'Sketching Faces on the Bus', true, false, 201, '#d8b4a0', '{art,sketching}', now() - interval '9 days', now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000102', 'a0000000-0000-0000-0000-000000000002', cw-1, cy, 'Rust vs Go: My Hot Take', true, false, 387, '#223843', '{coding,rust,go}', now() - interval '8 days', now() - interval '9 days'),
  ('b0000000-0000-0000-0000-000000000103', 'a0000000-0000-0000-0000-000000000003', cw-1, cy, 'Diving in Monterey Bay', true, false, 276, '#41b3a3', '{diving,ocean}', now() - interval '10 days', now() - interval '11 days'),
  ('b0000000-0000-0000-0000-000000000104', 'a0000000-0000-0000-0000-000000000004', cw-1, cy, 'Tokyo Street Photography Tips', true, false, 334, '#fb5012', '{tokyo,photography}', now() - interval '9 days', now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000106', 'a0000000-0000-0000-0000-000000000006', cw-1, cy, 'The Bookshop Around the Corner', true, false, 445, '#dbd3d8', '{books,travel}', now() - interval '8 days', now() - interval '9 days'),
  ('b0000000-0000-0000-0000-000000000107', 'a0000000-0000-0000-0000-000000000007', cw-1, cy, 'Parametric Design with Grasshopper', true, false, 298, '#4a7c59', '{architecture,design}', now() - interval '9 days', now() - interval '10 days'),
  ('b0000000-0000-0000-0000-000000000109', 'a0000000-0000-0000-0000-000000000009', cw-1, cy, 'Shooting on 16mm Film', true, true, 167, '#e8a87c', '{film,cinema}', now() - interval '7 days', now() - interval '8 days'),
  ('b0000000-0000-0000-0000-000000000110', 'a0000000-0000-0000-0000-000000000010', cw-1, cy, 'Bayesian Thinking in Everyday Life', true, false, 512, '#6b5b95', '{statistics,thinking}', now() - interval '10 days', now() - interval '11 days'),
  ('b0000000-0000-0000-0000-000000000112', 'a0000000-0000-0000-0000-000000000012', cw-1, cy, 'Latte Art Failures: A Gallery', true, false, 134, '#c38d9e', '{coffee,humor}', now() - interval '8 days', now() - interval '9 days');

-- Two weeks ago posts
INSERT INTO public.posts (id, user_id, week_number, year, title, is_published, is_late, word_count, cover_color, tags, published_at, created_at)
VALUES
  ('b0000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000001', cw-2, cy, 'Color Theory for UI Designers', true, false, 356, '#6b5b95', '{design,color}', now() - interval '16 days', now() - interval '17 days'),
  ('b0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000002', cw-2, cy, 'Building a CLI in Rust', true, false, 421, '#41b3a3', '{rust,coding,cli}', now() - interval '15 days', now() - interval '16 days'),
  ('b0000000-0000-0000-0000-000000000206', 'a0000000-0000-0000-0000-000000000006', cw-2, cy, 'Why I Reread Beloved Every Year', true, false, 389, '#223843', '{books,literature}', now() - interval '16 days', now() - interval '17 days'),
  ('b0000000-0000-0000-0000-000000000208', 'a0000000-0000-0000-0000-000000000008', cw-2, cy, 'Bouldering at Red Rocks', true, false, 245, '#fb5012', '{climbing,travel}', now() - interval '15 days', now() - interval '16 days'),
  ('b0000000-0000-0000-0000-000000000210', 'a0000000-0000-0000-0000-000000000010', cw-2, cy, 'A/B Testing Gone Wrong', true, false, 478, '#d8b4a0', '{data,work}', now() - interval '14 days', now() - interval '15 days');

-- One unpublished draft (for demo user current week — already published above, so use a different user)
INSERT INTO public.posts (id, user_id, week_number, year, title, is_published, is_late, word_count, cover_color, tags, created_at)
VALUES
  ('b0000000-0000-0000-0000-000000000050', 'a0000000-0000-0000-0000-000000000005', cw, cy, 'New Album Recommendations', false, false, 45, NULL, '{}', now() - interval '1 day');

END $$;

-- ============================================================
-- 5. Blocks — rich content for each post
-- ============================================================

-- Maya's current week post: "Portland Rain and Pixel Art"
INSERT INTO public.blocks (id, post_id, type, content, grid_layout_desktop, grid_layout_mobile, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'markdown',
   '{"markdown": "It rained every single day this week, which meant I barely left my apartment. But honestly? That''s when I do my best work. There''s something about the grey light filtering through my studio windows that makes the screen colors feel more intentional.\n\nI started a new pixel art series inspired by the Portland skyline — but reimagined as if it were a city in a Studio Ghibli film. The bridges become these whimsical structures with little lanterns hanging off them, and the trees along the waterfront turn into these massive ancient things with glowing moss.\n\nThe constraint of pixel art forces you to make every single dot count. You can''t hide behind anti-aliasing or gradients. Every color choice is deliberate, every shadow is a conscious decision. I think that''s why I keep coming back to it — in a world of infinite resolution, there''s something grounding about working within tight limits.\n\nAlso discovered a new ramen place on Division Street that might be the best in the city. The tonkotsu broth had this incredible depth — like someone had been simmering it since the Paleozoic era."}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 6}', 0),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'image',
   '{"url": "https://picsum.photos/seed/portland/600/400", "alt": "Pixel art of Portland skyline", "caption": "WIP: Ghibli Portland"}',
   '{"colStart": 3, "colSpan": 2, "rowStart": 1, "rowSpan": 4}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 7, "rowSpan": 4}', 1),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'spotify',
   '{"url": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"}',
   '{"colStart": 3, "colSpan": 1, "rowStart": 5, "rowSpan": 4}',
   '{"colStart": 1, "colSpan": 1, "rowStart": 11, "rowSpan": 2}', 2);

-- Jordan's current week post: "Debugging at 2AM"
INSERT INTO public.blocks (id, post_id, type, content, grid_layout_desktop, grid_layout_mobile, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000002', 'markdown',
   '{"markdown": "Picture this: it''s 2AM, your third cup of coffee is going cold, and you''ve been staring at the same 47 lines of code for three hours. The bug is somewhere in there. You know it. It knows you know it. It''s mocking you.\n\nThis week I was debugging a race condition in our payment processing pipeline. The kind of bug that only shows up under load, never in your local environment, and definitely not when anyone is watching. It''s like the Heisenberg uncertainty principle but for software — the act of observing the bug changes its behavior.\n\nI finally found it at 2:47AM on Wednesday. A missing mutex guard around a shared counter. Three characters: `mu.` That''s it. Three characters that took me 11 hours to find.\n\nBut here''s the thing — I love it. I genuinely love the hunt. There''s this moment right before you find the bug where everything clicks into place, where the mental model you''ve been building suddenly crystallizes and you can SEE the problem. That moment is better than any runner''s high.\n\nAlso went on a trail run at Forest Park on Saturday. 14 miles through the fog. My legs are absolutely destroyed but my brain feels clear for the first time all week."}',
   '{"colStart": 1, "colSpan": 3, "rowStart": 1, "rowSpan": 8}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}', 0),
  ('c0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', 'code',
   '{"code": "// The culprit — spot the missing lock\nfunc (s *Service) ProcessPayment(ctx context.Context, p Payment) error {\n    // s.mu.Lock()  // <- THIS WAS MISSING\n    s.counter++\n    // s.mu.Unlock()\n    \n    return s.pipeline.Execute(ctx, p)\n}", "language": "go"}',
   '{"colStart": 4, "colSpan": 1, "rowStart": 1, "rowSpan": 4}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 9, "rowSpan": 4}', 1);

-- Sam's current week post: "Whale Songs and Water Pressure"
INSERT INTO public.blocks (id, post_id, type, content, grid_layout_desktop, grid_layout_mobile, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000003', 'markdown',
   '{"markdown": "This week the hydrophone array picked up something extraordinary — a blue whale vocalization at a frequency we hadn''t recorded before in this region. 14.5 Hz, just below the threshold of human hearing. You can''t hear it, but you can feel it if you''re close enough. The ocean is full of sounds we''re only beginning to understand.\n\nI spent three days processing the acoustic data and cross-referencing it with satellite imagery. The whale appears to be a known individual — B47, nicknamed \"Maestro\" by researchers who''ve been tracking her for over a decade. She''s been moving north earlier than usual this year, which could be related to shifting water temperatures.\n\nThe pressure at the depths where these whales feed is staggering — over 100 atmospheres. Every square inch of their body is experiencing the weight of a small car. And yet they move with this incredible grace, these 80-foot beings gliding through darkness.\n\nLab work continues. My thesis advisor wants the frequency analysis chapter draft by next Friday. Send coffee."}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}', 0),
  ('c0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000003', 'image',
   '{"url": "https://picsum.photos/seed/ocean/600/400", "alt": "Ocean research equipment", "caption": "The hydrophone array at dawn"}',
   '{"colStart": 3, "colSpan": 2, "rowStart": 1, "rowSpan": 4}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 9, "rowSpan": 4}', 1);

-- Luna's current week post: "Five Books I Read This Week"
INSERT INTO public.blocks (id, post_id, type, content, grid_layout_desktop, grid_layout_mobile, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000030', 'b0000000-0000-0000-0000-000000000006', 'markdown',
   '{"markdown": "Yes, five. I had a cancelled flight and a very long layover in Denver. Here''s the rundown:\n\n**1. Tomorrow, and Tomorrow, and Tomorrow** by Gabrielle Zevin — Finally read this and I get the hype. The way it handles creative partnerships and the passage of time is masterful. Made me think about all the people I''ve made things with and how those collaborations shaped who I am.\n\n**2. The Remains of the Day** by Kazuo Ishiguro — A reread. Stevens is one of the most heartbreaking narrators in English literature. Every time I read it I notice another layer of self-deception.\n\n**3. Piranesi** by Susanna Clarke — Strange and beautiful and unlike anything else. The House feels so real I dreamt about it.\n\n**4. Dept. of Speculation** by Jenny Offill — Read this in one sitting at the airport. Short but devastating. The fragment structure shouldn''t work but it absolutely does.\n\n**5. How to Do Nothing** by Jenny Odell — Needed this reminder that productivity isn''t the only measure of a life well spent. Especially relevant as I sat in an airport doing literally nothing.\n\nAll highly recommended. My cats were unimpressed by my literary accomplishments and would like me to refill their food bowl."}',
   '{"colStart": 1, "colSpan": 3, "rowStart": 1, "rowSpan": 10}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 10}', 0),
  ('c0000000-0000-0000-0000-000000000031', 'b0000000-0000-0000-0000-000000000006', 'image',
   '{"url": "https://picsum.photos/seed/books/400/600", "alt": "Stack of books on a nightstand", "caption": "The stack"}',
   '{"colStart": 4, "colSpan": 1, "rowStart": 1, "rowSpan": 4}',
   '{"colStart": 1, "colSpan": 1, "rowStart": 11, "rowSpan": 4}', 1);

-- Zoë's current week post: "My Sourdough Finally Didn't Collapse"
INSERT INTO public.blocks (id, post_id, type, content, grid_layout_desktop, grid_layout_mobile, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000040', 'b0000000-0000-0000-0000-000000000008', 'markdown',
   '{"markdown": "TWELVE ATTEMPTS. Twelve flat, dense, sad little bread bricks before I finally got an actual rise. I almost cried. My roommate definitely cried (she''s been eating the failures).\n\nThe secret? I was over-proofing. Every guide says to let it proof until it \"doubles in size\" but my kitchen runs cold so I was leaving it way too long trying to hit that mark. Switched to the poke test — if you poke the dough and it springs back slowly, it''s ready. If it springs back fast, needs more time. If it doesn''t spring back at all, you''ve gone too far (story of my life).\n\nThe crumb on this one was actually open and airy. OPEN AND AIRY. I keep looking at the photos like a proud parent. My starter, Gertrude, has been with me for four months now and I think she''s finally hitting her stride.\n\nIn non-bread news: sent my hardest climbing route this week — a V5 overhang at the gym. My forearms have never been so tired and so happy."}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}', 0),
  ('c0000000-0000-0000-0000-000000000041', 'b0000000-0000-0000-0000-000000000008', 'image',
   '{"url": "https://picsum.photos/seed/bread/400/400", "alt": "A beautiful sourdough loaf", "caption": "SHE ROSE!!! 🍞"}',
   '{"colStart": 3, "colSpan": 1, "rowStart": 1, "rowSpan": 2}',
   '{"colStart": 1, "colSpan": 1, "rowStart": 9, "rowSpan": 2}', 1),
  ('c0000000-0000-0000-0000-000000000042', 'b0000000-0000-0000-0000-000000000008', 'image',
   '{"url": "https://picsum.photos/seed/crumb/400/400", "alt": "Sourdough crumb shot", "caption": "The crumb!"}',
   '{"colStart": 4, "colSpan": 1, "rowStart": 1, "rowSpan": 2}',
   '{"colStart": 2, "colSpan": 1, "rowStart": 9, "rowSpan": 2}', 2);

-- Elena's current week post: "Berlin Streets in April"
INSERT INTO public.blocks (id, post_id, type, content, grid_layout_desktop, grid_layout_mobile, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000050', 'b0000000-0000-0000-0000-000000000010', 'markdown',
   '{"markdown": "April in Berlin is this strange, beautiful liminal space. The trees along Unter den Linden are just starting to bud, the tourists haven''t fully arrived yet, and there''s this quality of light in the late afternoon that makes everything look like a Hopper painting.\n\nI''ve been walking a different route to the office every day this week, letting the city surprise me. On Tuesday I found a tiny courtyard in Mitte that I''d never seen before — full of wisteria and a single rusted bicycle leaning against a wall. On Thursday I stumbled into a gallery opening in Kreuzberg where an artist had recreated the entire Berlin U-Bahn map using pressed flowers.\n\nThe data work continues. We''re building a new anomaly detection pipeline at work and I''ve been neck-deep in time series analysis. There''s a satisfying parallel between finding patterns in data and finding patterns in a city — both reward patience and curiosity.\n\nThis city never stops revealing itself. Three years here and I still find new corners every week."}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}', 0),
  ('c0000000-0000-0000-0000-000000000051', 'b0000000-0000-0000-0000-000000000010', 'image',
   '{"url": "https://picsum.photos/seed/berlin/600/400", "alt": "Berlin street in spring", "caption": "Prenzlauer Berg, golden hour"}',
   '{"colStart": 3, "colSpan": 2, "rowStart": 1, "rowSpan": 4}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 9, "rowSpan": 4}', 1);

-- Demo user's current week post: "Welcome to Edition"
INSERT INTO public.blocks (id, post_id, type, content, grid_layout_desktop, grid_layout_mobile, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000060', 'b0000000-0000-0000-0000-000000000011', 'markdown',
   '{"markdown": "Welcome to Edition! This is a demo post showing how the platform works.\n\nEvery week, you write about whatever''s on your mind — what you''re working on, what you''re learning, what you ate for lunch. The only rules are: give it a title, write at least 100 words, and publish before Sunday midnight.\n\nWhen you publish, you unlock your feed for the week. That''s the deal — you share, you get to see what others shared. It''s a simple social contract that keeps everyone creating.\n\nYou can add different types of blocks to your posts: text, images, code snippets, Spotify embeds, and more. Arrange them however you like in the bento grid — drag to reposition, resize by grabbing the corners.\n\nHappy writing!"}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 6}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 6}', 0),
  ('c0000000-0000-0000-0000-000000000061', 'b0000000-0000-0000-0000-000000000011', 'code',
   '{"code": "// The social contract\nif (user.hasPublished(thisWeek)) {\n  return unlockFeed();\n} else {\n  return showLockScreen();\n}", "language": "javascript"}',
   '{"colStart": 3, "colSpan": 2, "rowStart": 1, "rowSpan": 4}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 7, "rowSpan": 4}', 1);

-- A few blocks for last week's posts too
INSERT INTO public.blocks (id, post_id, type, content, grid_layout_desktop, grid_layout_mobile, sort_order) VALUES
  ('c0000000-0000-0000-0000-000000000070', 'b0000000-0000-0000-0000-000000000101', 'markdown',
   '{"markdown": "I''ve been carrying a small sketchbook on my bus commute and drawing the faces of strangers. Not detailed portraits — quick gesture drawings, trying to capture the essence of someone in 30 seconds before they look up from their phone.\n\nThere''s a woman who takes the 14 every morning. She always has a book — actual paper book, not a Kindle — and she holds it close to her face like she''s trying to climb inside the story. I''ve drawn her six times now and each sketch catches something different.\n\nThe bus is the perfect studio. Constant new subjects, good light, and a built-in timer (your stop is coming). Plus nobody notices. Everyone''s too deep in their own world.\n\nThis week I filled 23 pages. Some of them are genuinely terrible. A few might be good. That ratio feels about right."}',
   '{"colStart": 1, "colSpan": 3, "rowStart": 1, "rowSpan": 6}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 6}', 0),
  ('c0000000-0000-0000-0000-000000000071', 'b0000000-0000-0000-0000-000000000102', 'markdown',
   '{"markdown": "Okay, hot take time: after six months of writing production Rust and three years of Go, I have opinions.\n\nRust makes you think harder upfront. The borrow checker is genuinely annoying for the first month, then it becomes this incredible safety net. You stop worrying about data races entirely. Your code is slower to write but you ship fewer bugs.\n\nGo is the opposite philosophy — get it working fast, the runtime will handle the rest. The garbage collector does its thing, goroutines are cheap, and the standard library is excellent. You write more code but you write it faster.\n\nNeither is better. They''re different tools for different problems. Rust for systems where correctness matters more than velocity. Go for services where shipping matters more than perfection.\n\nThe real hot take? I''d pick Python for most things if performance didn''t matter. Don''t @ me.\n\nThis week I ported our metrics aggregator from Go to Rust and the throughput went up 3x. The rewrite took 4x longer. Math checks out if you squint."}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 10}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 10}', 0),
  ('c0000000-0000-0000-0000-000000000072', 'b0000000-0000-0000-0000-000000000106', 'markdown',
   '{"markdown": "Every neighborhood needs a bookshop with a cat. I found mine this week — tucked behind a laundromat on a street I''ve walked a hundred times without noticing.\n\nThe owner is an older woman named Margaret who curates with impeccable taste. No bestseller tables, no promotional displays. Just shelves organized by vibes: ''melancholy but hopeful,'' ''makes you want to cook,'' ''read this on a train.''\n\nThe cat — a massive orange tabby named Hemingway, naturally — was asleep on a stack of Murakami novels. He opened one eye when I walked in, judged me insufficient, and went back to sleep.\n\nI left with three books I''d never heard of and a recommendation to come back on Thursdays when Margaret hosts a silent reading hour. You just show up, sit in a chair, and read. No discussion, no book club agenda. Just shared quiet.\n\nI think I''ve found my place."}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}',
   '{"colStart": 1, "colSpan": 2, "rowStart": 1, "rowSpan": 8}', 0);
