-- The subscription's regular price, shown on the homepage next to the
-- launch price (subscription.price_in_cfa, what is actually charged): "prix
-- de lancement, bientôt 35 000 F". Display only — nothing is ever charged
-- from it. 0, or any value not above the current price, hides the mention.
INSERT INTO parameter_versions (parameter_key, value) VALUES
  ('subscription.regular_price_in_cfa', 35000);
