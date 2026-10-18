-- Guests' AI activity is no longer kept: many people can share one network address.
DELETE FROM "ai_events" WHERE "subject" NOT LIKE 'user:%';
