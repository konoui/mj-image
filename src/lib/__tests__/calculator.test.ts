import {
  ShantenCalculator,
  BlockCalculator,
  Hand,
  HandData,
  DoubleCalculator,
  BoardContext,
  WinResult,
} from "../calculator";
import { TYPE, OPERATOR } from "../core/constants";
import { Block, Parser, Tile } from "../core/parser";
import { handsToString } from "./utils/helper";
describe("Hand", () => {
  const getData = (h: Hand) => {
    return (h as any).data as HandData;
  };
  test("init", () => {
    const c = new Hand("12234m123w1d, -123s, t2p");
    const want: HandData = {
      [TYPE.M]: [0, 1, 2, 1, 1, 0, 0, 0, 0, 0],
      [TYPE.S]: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [TYPE.P]: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [TYPE.BACK]: ["untouchable", 0],
      [TYPE.Z]: [0, 1, 1, 1, 0, 1, 0, 0],
      called: new Parser("-123s").parse(),
      reached: false,
      tsumo: new Tile(TYPE.P, 2, [OPERATOR.TSUMO]),
    };
    expect((c as any).data).toStrictEqual(want);
  });
  test("operations", () => {
    const h = new Hand("122234m123w1d");
    const want: HandData = {
      [TYPE.M]: [0, 1, 3, 1, 1, 0, 0, 0, 0, 0],
      [TYPE.S]: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [TYPE.P]: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [TYPE.BACK]: ["untouchable", 0],
      [TYPE.Z]: [0, 1, 1, 1, 0, 1, 0, 0],
      called: [],
      reached: false,
      tsumo: null,
    };
    // initial check
    expect(getData(h)).toStrictEqual(want);

    const tsumo = new Tile(TYPE.M, 2, [OPERATOR.TSUMO]);
    h.draw(tsumo);
    want.tsumo = tsumo;
    want[TYPE.M][tsumo.n] += 1;
    expect(getData(h)).toStrictEqual(want);

    const chi = new Parser("-534m").parse()[0];
    h.call(chi);
    want.called = [...want.called, chi];
    want.m[3] -= 1;
    want.m[4] -= 1;
    want.tsumo = null;
    expect(getData(h)).toStrictEqual(want);

    const ankan = new Parser("_22_m").parse()[0];
    h.kan(ankan);
    want.called = [...want.called, ankan];
    want.m[2] -= 4;
    expect(getData(h)).toStrictEqual(want);

    expect(() => {
      h.discard(tsumo);
    }).toThrow(/unable to decrease/);
  });

  test("inc/dec", () => {
    const h = new Hand("406m");
    const dtiles = h.dec([new Tile(TYPE.M, 5)]);
    h.inc(dtiles);
    expect(h.toString()).toStrictEqual("4r56m");
  });
  test("inc/dec", () => {
    const h = new Hand("405556m");
    const dtiles = h.dec([new Tile(TYPE.M, 5, [OPERATOR.RED])]);
    h.inc(dtiles);
    expect(h.toString()).toStrictEqual("4r55556m");
  });
  test("inc/dec", () => {
    const h = new Hand("4556m");
    const itiles = h.inc([new Tile(TYPE.M, 5, [OPERATOR.RED])]);
    h.dec(itiles);
    expect(h.toString()).toStrictEqual("4556m");
  });
});

test("idempotency hand", () => {
  const input = "123m123s123p1z,t1z";
  const h = new Hand(input);
  expect(h.drawn?.toString()).toEqual("t1z");

  const ch = new Hand(h.toString());
  expect(ch.drawn?.toString()).toEqual("t1z");

  expect(h.toString()).toEqual("123m123p123s1z,t1z");
});

describe("Shanten Calculator", () => {
  const tests = [
    {
      name: "seven pairs tenpai",
      input: "1122334455667m",
      want: 0,
      handler: "Seven",
    },
    {
      name: "seven pairs 1 shanten",
      input: "1122334455678m",
      want: 1,
      handler: "Seven",
    },
    {
      name: "seven pairs 2 shanten",
      input: "1122334456789m",
      want: 2,
      handler: "Seven",
    },
    {
      name: "seven pairs 3 shanten",
      input: "112233456789m1s",
      want: 3,
      handler: "Seven",
    },
    {
      name: "seven pairs 3 shanten",
      input: "1123456789m123s",
      want: 5,
      handler: "Seven",
    },
    {
      name: "thirteen orphans waiting 13 tiles",
      input: "19m19s19p1234567z",
      want: 0,
      handler: "Orphans",
    },
    {
      name: "thirteen orphans waiting 7z",
      input: "19m19s19p123456z1p",
      want: 0,
      handler: "Orphans",
    },
    {
      name: "thirteen orphans 13 tiles",
      input: "19m19s19p123456w2p",
      want: 1,
      handler: "Orphans",
    },
    {
      name: "common",
      input: "123m456m789m123s1p",
      want: 0,
      handler: "Common",
    },
    {
      name: "common",
      input: "123m456m789m12s11p",
      want: 0,
      handler: "Common",
    },
    {
      name: "common",
      input: "123m456m789m12s1p1z",
      want: 1,
      handler: "Common",
    },
    {
      name: "common",
      input: "111m456m789m12s1p1z",
      want: 1,
      handler: "Common",
    },
  ];

  for (const tt of tests) {
    test(tt.name, () => {
      const h = new Hand(tt.input);
      const c = new ShantenCalculator(h);
      let got: number = -1;
      if (tt.handler == "Seven") got = c.sevenPairs();
      else if (tt.handler == "Orphans") got = c.thirteenOrphans();
      else if (tt.handler == "Common") got = c.fourSetsOnePair();
      else throw new Error(`unexpected handler ${tt.handler}`);
      expect(got).toBe(tt.want);
    });
  }
});

describe("Block Calculator", () => {
  const tests = [
    {
      name: "seven pairs tenpai",
      input: "11223344556677m",
      want: [["11m", "22m", "33m", "44m", "55m", "66m", "77m"]],
      handler: "Seven",
    },
    {
      name: "thirteen orphans waiting 13 tiles",
      input: "19m19s19p1234567z1m",
      want: [
        [
          "11m",
          "9m",
          "1p",
          "9p",
          "1s",
          "9s",
          "1z",
          "2z",
          "3z",
          "4z",
          "5z",
          "6z",
          "7z",
        ],
      ],
      handler: "Orphans",
    },
    {
      name: "nine gates",
      input: "11123456789990m",
      want: [["111234r55678999m"]],
      handler: "Nine",
    },
    {
      name: "simple",
      input: "111m456m789m123s11p",
      want: [["11p", "111m", "456m", "789m", "123s"]],
      handler: "Common",
    },
    {
      name: "with called",
      input: "111m456m789m11p,-213s",
      want: [["11p", "111m", "456m", "789m", "-213s"]],
      handler: "Common",
    },
    {
      name: "multiple",
      input: "111222333m123s11p",
      want: [
        ["11p", "123m", "123m", "123m", "123s"],
        ["11p", "111m", "222m", "333m", "123s"],
      ],
      handler: "Common",
    },
    {
      name: "two sets",
      input: "11223344556677m",
      want: [
        ["11m", "234m", "234m", "567m", "567m"],
        ["44m", "123m", "123m", "567m", "567m"],
        ["77m", "123m", "123m", "456m", "456m"],
      ],
      handler: "Common",
    },
    {
      name: "common",
      input: "111123m123s123p11z",
      want: [["11z", "123m", "111m", "123p", "123s"]],
      handler: "Common",
    },
    {
      name: "common",
      input: "123m123s123p111z22m",
      want: [["22m", "123m", "123p", "123s", "111z"]],
      handler: "Common",
    },
    {
      name: "common with red",
      input: "123m123pr555s111z22m",
      want: [["22m", "123m", "123p", "r555s", "111z"]],
      handler: "Common",
    },
    {
      name: "seven with red",
      input: "11s33sr55s66s88s11z22z",
      want: [["11s", "33s", "r55s", "66s", "88s", "11z", "22z"]],
      handler: "Seven",
    },
  ];

  for (const tt of tests) {
    test(tt.name, () => {
      const h = new Hand(tt.input);
      const c = new BlockCalculator(h);
      let got: readonly Block[][] = [];
      if (tt.handler == "Seven") got = c.sevenPairs();
      else if (tt.handler == "Orphans") got = c.thirteenOrphans();
      else if (tt.handler == "Common") got = c.fourSetsOnePair();
      else if (tt.handler == "Nine") got = c.nineGates();
      else throw new Error(`unexpected handler ${tt.handler}`);
      expect(handsToString(got)).toStrictEqual(tt.want);
    });
  }
});

test("calc with drawn", () => {
  const h = new Hand("1223m123s111z, -123m");
  h.draw(new Tile(TYPE.M, 2));
  const c = new BlockCalculator(h);
  const want = [
    ["t22m", "123m", "123s", "111z", "-123m"],
    ["22m", "1t23m", "123s", "111z", "-123m"],
  ];
  const got = handsToString(c.calc(h.drawn!));
  expect(got).toStrictEqual(want);
});

test("commonByKind", () => {
  const h = new Hand("111222333456m");
  const c = new BlockCalculator(h);
  const got = (c as any).handleNumType(TYPE.M) as Block[][];
  const want = [
    ["123m", "123m", "123m", "456m"],
    ["111m", "234m"],
    ["111m", "222m", "345m"],
    ["111m", "222m", "333m", "456m"],
  ];
  expect(handsToString(got)).toStrictEqual(want);
});

test("handleCommon", () => {
  const h = new Hand("111222333456m111s");
  const c = new BlockCalculator(h);
  const got = (c as any).patternAll() as Block[][];
  const want = [
    ["123m", "123m", "123m", "456m", "111s"],
    ["111m", "234m", "111s"],
    ["111m", "222m", "345m", "111s"],
    ["111m", "222m", "333m", "456m", "111s"],
  ];
  expect(handsToString(got)).toStrictEqual(want);
});

describe("double Calculator", () => {
  const tests = [
    {
      input: "123123s111222m22z",
      lastTile: new Tile(TYPE.S, 1, [OPERATOR.TSUMO]),
      want: [
        {
          points: [
            { name: "門前清自摸和", double: 1 },
            { name: "一盃口", double: 1 },
          ],
          fu: 34,
        },
      ],
    },
    {
      input: "123123s123m123p22z",
      lastTile: new Tile(TYPE.S, 1),
      want: [
        {
          points: [
            { name: "平和", double: 1 },
            { name: "一盃口", double: 1 },
            { name: "三色同順", double: 2 },
            { name: "混全帯么九", double: 2 },
          ],
          fu: 30,
        },
      ],
    },
    {
      input: "111222333s123m99s",
      lastTile: new Tile(TYPE.S, 1, [OPERATOR.TSUMO]),
      want: [
        {
          points: [
            { name: "門前清自摸和", double: 1 },
            { name: "平和", double: 1 },
            { name: "一盃口", double: 1 },
            { name: "純全帯么九色", double: 3 },
          ],
          fu: 20,
        },
        {
          points: [
            { name: "門前清自摸和", double: 1 },
            { name: "三暗刻", double: 2 },
          ],
          fu: 38,
        },
      ],
    },
    {
      input: "111333555s123m99s",
      lastTile: new Tile(TYPE.S, 1),
      want: [{ points: [], fu: 42 }],
    },
    {
      input: "222333s234m88567s",
      lastTile: new Tile(TYPE.S, 2),
      want: [{ points: [{ name: "断么九", double: 1 }], fu: 36 }],
    },
    {
      input: "12344456789m123s",
      lastTile: new Tile(TYPE.S, 3),
      want: [
        {
          points: [
            { name: "一気通貫", double: 2 },
            { name: "ドラ", double: 1 },
          ],
          fu: 32,
        },
      ],
    },
    {
      input: "112233m223344s22z",
      lastTile: new Tile(TYPE.M, 1),
      want: [
        { points: [{ name: "七対子", double: 2 }], fu: 25 },
        {
          points: [
            { name: "平和", double: 1 },
            { name: "ニ盃口", double: 3 },
          ],
          fu: 30,
        },
      ],
    },
    {
      input: "23456788mm, -234s, 2-34p",
      lastTile: new Tile(TYPE.M, 3, [OPERATOR.TSUMO]),
      want: [
        {
          points: [
            { name: "断么九", double: 1 },
            { name: "三色同順", double: 1 },
          ],
          fu: 24,
        },
      ],
    },
    {
      input: "111333m11p,5-5-55s, -3333s",
      lastTile: new Tile(TYPE.M, 3, [OPERATOR.TSUMO]),
      want: [{ points: [{ name: "対々和", double: 2 }], fu: 50 }],
    },
  ];
  for (let tt of tests) {
    test(tt.input, () => {
      const h = new Hand(tt.input);
      const c = new BlockCalculator(h);
      const cfg: BoardContext = {
        doraMarkers: [new Tile(TYPE.M, 8)],
        myWind: "1w",
        round: "1w1",
      };
      const dc = new DoubleCalculator(h, cfg);
      const hands = c.calc(tt.lastTile);
      const got = dc.calcPatterns(hands).map((v) => {
        return { points: v.points, fu: v.fu };
      });
      //console.log(handsToString(hands));
      //console.log(JSON.stringify(got));
      expect(got).toStrictEqual(tt.want);
    });
  }
});

describe("calc", () => {
  test("1", () => {
    const input = "111333m11p,5-5-55s, -3333s";
    const h = new Hand(input);
    const c = new BlockCalculator(h);
    const cfg: BoardContext = {
      doraMarkers: [new Tile(TYPE.M, 8)],
      myWind: "1w",
      round: "1w1",
      ronWind: "2w",
    };
    const dc = new DoubleCalculator(h, cfg);
    const hands = c.calc(new Tile(TYPE.M, 3, [OPERATOR.RON]));
    const got = dc.calc(...hands);

    // TODO
    expect(!!got).toEqual(true);

    // console.log(got);
  });
  test("2", () => {
    const input = "-123s,-234s,-456m, -567m, 11m";
    const lastTile = new Tile(TYPE.M, 1, [OPERATOR.TSUMO]);
    const h = new Hand(input);
    const c = new BlockCalculator(h);
    const cfg: BoardContext = {
      doraMarkers: [new Tile(TYPE.M, 8)],
      myWind: "1w",
      round: "1w1",
      ronWind: "2w",
    };
    const dc = new DoubleCalculator(h, cfg);
    const hands = c.calc(lastTile);
    const got = dc.calc(...hands);

    // TODO
    expect(!!got).toEqual(true);
    // console.log(got);
  });
  test("3", () => {
    const input = "123m123s123p789p9m,t9m";
    const h = new Hand(input);
    const c = new BlockCalculator(h);
    const cfg: BoardContext = {
      doraMarkers: [new Tile(TYPE.M, 9, [OPERATOR.TSUMO])],
      myWind: "1w",
      round: "1w1",
      ronWind: "2w",
    };
    const dc = new DoubleCalculator(h, cfg);
    const hands = c.calc(new Tile(TYPE.M, 3, [OPERATOR.RON]));
    const got = dc.calc(...hands);

    expect(!!got).toEqual(true);
    expect((got as WinResult).sum).toBe(7);
    expect((got as WinResult).point).toBe(18000);
  });
});
