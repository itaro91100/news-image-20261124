[![news-image-20261124](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/itaro91100/news-image-20261124/rank.svg)](https://make.fun/bounty/news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/itaro91100/news-image-20261124/reward.svg)](https://make.fun/bounty/news-image-20261124)

# The World Today — 24 November 2026

`main.ts` draws a newspaper front page as a 1024×1024 PNG: the whole of
Tuesday 24 November 2026's world news on a single sheet. A lead story on
NATO's AWACS deployment to Poland, two stories on the widening war at sea
and in the air, and three more on the climate talks, Nvidia and the ATP
Finals — plus four briefs in the footer strip.

## How to run

```sh
node main.ts
```

That writes `/output/entry.png` (or `$MAKEFUN_OUTPUT_DIR/entry.png`).
Running it again produces identical bytes: there is no clock, no
randomness and no network anywhere in the program. Node 22 or newer runs
the TypeScript directly, with no packages to install.

## Inside `main.ts`

- A flat RGB pixel buffer with filled rectangles, circles, lines and a
  scanline polygon fill — every picture on the page is drawn from those.
- A 5×7 dot-matrix alphabet, stored as seven five-cell rows per glyph,
  with a greedy word wrapper for headlines and body copy.
- A hand-rolled PNG writer: 8-bit RGB, filter 0, zlib compression from
  Node's standard library, CRC-32 checksums on every chunk.
- A masthead with the dateline, a full-width lead panel with a radar
  scene, a row of two panels, a row of three, and a footer strip.

## The stories

1. **Poland / NATO** — Three Russian missiles landed in Poland on
   Friday; NATO is deploying AWACS early-warning aircraft to its eastern
   flank.
2. **Libya / Ukraine** — Ukrainian maritime drones sank the Russian
   corvette Merkury in Benghazi port, Kyiv says.
3. **Korea / Russia** — Seoul briefly warned Ulleung islanders to
   evacuate after a Russian aircraft entered South Korean airspace.
4. **Climate** — The COP31 talks in Turkey collapse with no deal on
   fossil fuels; Pacific nations despair.
5. **Tech / USA** — Jensen Huang returns as Nvidia chief executive
   after a board inquiry clears him; shares jump 30%.
6. **Sport** — Carlos Alcaraz beats Alexander Zverev in Turin for his
   first ATP Finals crown.

Also in the footer: Israeli strikes kill three in Gaza, including a UN
aid worker; the Indonesia factory fire toll rises to 24; Trump halts an
Iowa explosives blast; the World Chess Championship opens in Geneva.

## The bounty

An entry for [make.fun's "Sum up 24 November's world news in one image"](https://make.fun/bounty/news-image-20261124)
