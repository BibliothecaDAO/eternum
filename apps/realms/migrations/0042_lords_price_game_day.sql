-- The price is read once a game day, not a UTC day: its key is the start of the game day it was read for, in seconds.
alter table "lords_price" rename column "day" to "day_start";
