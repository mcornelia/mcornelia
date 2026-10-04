# Daily Fetch vocabulary

`common-english.txt` is a frozen, lowercase ASCII subset (4–12 letters) of SCOWL levels 10, 20, 35, 40, and 50, combining `english-words` and `american-words`. Downloaded October 4, 2026 from https://github.com/deepin-community/scowl/tree/master/final (the corresponding raw files). British, variant, proper-name, and specialist lists were not included. This favors familiar English; it is not an official licensed Scrabble dictionary or a guarantee that every word is familiar to every player.

SCOWL project: https://wordlist.aspell.net/ . The source copyright and permissions are reproduced in `../../play/daily-fetch/WORDLIST-LICENSE.txt`; retain that notice when redistributing this list or generated word data. `excluded.txt` contains the additional family-game exclusions.

Rebuild with `node scripts/build-daily-fetch-modern.mjs`, then run `node --test tests/*fetch*.test.mjs`. The builder filters the frozen variety pack and deterministically replaces boards that cannot satisfy all goals. It preserves the October 4 release board and provides compatibility for an already-started older board. Older builders remain historical sources and do not generate the active modern pack.
