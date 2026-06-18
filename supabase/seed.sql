INSERT INTO question_sets (id, name, theme)
VALUES ('11111111-1111-1111-1111-111111111111', 'Alpha Pop Culture', 'general');

INSERT INTO questions (question_set_id, order_index, body, choices, correct_choice_id, difficulty, category) VALUES
('11111111-1111-1111-1111-111111111111', 1, 'Which film won the Academy Award for Best Picture in 1994?',
 '[{"id":"a","text":"Pulp Fiction"},{"id":"b","text":"Forrest Gump"},{"id":"c","text":"The Shawshank Redemption"}]'::jsonb, 'b', 1, 'movies'),
('11111111-1111-1111-1111-111111111111', 2, 'How many players are on the field for one soccer team during play?',
 '[{"id":"a","text":"9"},{"id":"b","text":"10"},{"id":"c","text":"11"}]'::jsonb, 'c', 1, 'sports'),
('11111111-1111-1111-1111-111111111111', 3, 'What planet is known as the Red Planet?',
 '[{"id":"a","text":"Venus"},{"id":"b","text":"Mars"},{"id":"c","text":"Jupiter"}]'::jsonb, 'b', 1, 'science'),
('11111111-1111-1111-1111-111111111111', 4, 'Who painted the Mona Lisa?',
 '[{"id":"a","text":"Vincent van Gogh"},{"id":"b","text":"Leonardo da Vinci"},{"id":"c","text":"Michelangelo"}]'::jsonb, 'b', 1, 'history'),
('11111111-1111-1111-1111-111111111111', 5, 'Which TV series features the fictional coffee shop Central Perk?',
 '[{"id":"a","text":"Seinfeld"},{"id":"b","text":"Friends"},{"id":"c","text":"How I Met Your Mother"}]'::jsonb, 'b', 1, 'tv'),
('11111111-1111-1111-1111-111111111111', 6, 'What is the chemical symbol for gold?',
 '[{"id":"a","text":"Go"},{"id":"b","text":"Gd"},{"id":"c","text":"Au"}]'::jsonb, 'c', 2, 'science'),
('11111111-1111-1111-1111-111111111111', 7, 'Which artist released the album ''1989''?',
 '[{"id":"a","text":"Adele"},{"id":"b","text":"Taylor Swift"},{"id":"c","text":"Beyoncé"}]'::jsonb, 'b', 1, 'music'),
('11111111-1111-1111-1111-111111111111', 8, 'In what year did World War II end?',
 '[{"id":"a","text":"1943"},{"id":"b","text":"1945"},{"id":"c","text":"1947"}]'::jsonb, 'b', 2, 'history'),
('11111111-1111-1111-1111-111111111111', 9, 'Which company created the character Mario?',
 '[{"id":"a","text":"Sega"},{"id":"b","text":"Nintendo"},{"id":"c","text":"Sony"}]'::jsonb, 'b', 1, 'games'),
('11111111-1111-1111-1111-111111111111', 10, 'What is the capital of Australia?',
 '[{"id":"a","text":"Sydney"},{"id":"b","text":"Melbourne"},{"id":"c","text":"Canberra"}]'::jsonb, 'c', 2, 'geography'),
('11111111-1111-1111-1111-111111111111', 11, 'Which meme features a distracted boyfriend looking at another woman?',
 '[{"id":"a","text":"Doge"},{"id":"b","text":"Distracted Boyfriend"},{"id":"c","text":"Grumpy Cat"}]'::jsonb, 'b', 1, 'memes'),
('11111111-1111-1111-1111-111111111111', 12, 'Who directed ''Jurassic Park'' (1993)?',
 '[{"id":"a","text":"James Cameron"},{"id":"b","text":"Steven Spielberg"},{"id":"c","text":"George Lucas"}]'::jsonb, 'b', 2, 'movies');

INSERT INTO shows (scheduled_at, question_set_id, theme)
VALUES (now() + interval '1 hour', '11111111-1111-1111-1111-111111111111', 'general');
