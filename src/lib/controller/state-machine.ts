import { Wind, TYPE, WIND, OP } from "../core/constants";
import {
  ChoiceAfterDiscardedEvent,
  ChoiceAfterDrawnEvent,
  ChoiceForChanKan,
  ChoiceForReachAcceptance,
  Controller,
  ReachAcceptedEvent,
  ReachEvent,
  RonEvent,
} from "./index";
import {
  BlockAnKan,
  BlockChi,
  BlockDaiKan,
  BlockPon,
  BlockShoKan,
  Block,
  Tile,
} from "../core/parser";
import {
  Candidate,
  SerializedCandidate,
  ShantenCalculator,
  WinResult,
  SerializedWinResult,
} from "./../calculator";
import { nextWind, createWindMap } from "../core";
import { assert } from "../myassert";

type ControllerContext = {
  currentWind: Wind;
  oneShotMap: { [key in Wind]: boolean };
  missingMap: { [key in Wind]: boolean };
  controller: Controller;
  genEventID: ReturnType<typeof incrementalIDGenerator>;
};

import { createMachine } from "xstate";

const serializeBlocksOrFalse = (b: Block[] | false) => {
  if (b === false) return false;
  return b.map((v) => v.serialize());
};

const serializeBlockOrFalse = (b: Block | false) => {
  if (b === false) return false;
  return b.serialize();
};

const serializeCandidate = (
  cs: Candidate[] | false
): SerializedCandidate[] | false => {
  if (cs === false) return false;
  return cs.map((c) => {
    return {
      tile: c.tile.toString(),
      candidates: c.candidates.map((v) => v.toString()),
      shanten: c.shanten,
    };
  });
};

const serializeWinResult = (ret: WinResult) => {
  const v = JSON.parse(JSON.stringify(ret)) as SerializedWinResult;
  return v;
};

const serializeWinResultOrFalse = (ret: WinResult | false) => {
  if (ret === false) return false;
  return serializeWinResult(ret);
};

export const createControllerMachine = (c: Controller) => {
  return createMachine(
    {
      id: "Untitled",
      initial: "distribute",
      context: {
        currentWind: WIND.E,
        oneShotMap: createWindMap(false),
        missingMap: createWindMap(false),
        controller: c,
        genEventID: incrementalIDGenerator(),
      },
      states: {
        distribute: {
          on: {
            NEXT: {
              target: "drawn",
            },
          },
          entry: {
            type: "notify_distribution",
          },
        },
        drawn: {
          entry: {
            type: "notify_draw",
          },
          on: {
            NEXT: {
              target: "waiting_user_event_after_drawn",
              actions: {
                type: "notify_choice_after_drawn",
              },
              description:
                "可能なアクションとその詳細を通知\\\nDISCARD の場合は捨てられる牌の一覧",
            },
          },
        },
        waiting_user_event_after_drawn: {
          description: "ツモった1ユーザからのレスポンス待ち",
          on: {
            TSUMO: {
              target: "tsumo",
              guard: "canWin",
            },
            REACH: {
              target: "waiting_reach_acceptance",
              actions: [
                {
                  type: "notify_reach",
                },
                {
                  type: "notify_choice_for_reach_acceptance",
                },
              ],
              guard: {
                type: "canReach",
              },
            },
            SHO_KAN: {
              target: "an_sho_kaned",
            },
            AN_KAN: {
              target: "an_sho_kaned",
            },
            DISCARD: {
              target: "discarded",
              description: "入力に牌が必須",
              actions: {
                type: "disable_one_shot_for_me",
              },
            },
            DRAWN_GAME_BY_NINE_ORPHANS: {
              target: "drawn_game",
              // TODO guard for drawn game
            },
          },
        },
        discarded: {
          entry: {
            type: "notify_discard",
            // FIXME add notify_new_dora_if_needed
          },
          on: {
            NEXT: {
              target: "waiting_user_event_after_discarded",
              actions: {
                type: "notify_choice_after_discarded",
              },
              description:
                "可能なアクションとその詳細を通知\\\nCHI/PON の場合は鳴ける組み合わせの一覧",
            },
          },
        },
        tsumo: {
          exit: [
            {
              type: "notify_tsumo",
            },
            {
              type: "notify_end",
            },
          ],
          type: "final",
        },
        waiting_reach_acceptance: {
          on: {
            REACH_ACCEPT: {
              target: "reached",
            },
            RON: {
              target: "roned",
              guard: {
                type: "canWin",
              },
            },
          },
          description: "リーチに対するアクションは RON か ACCEPT のみである",
        },
        waiting_user_event_after_discarded: {
          description:
            "最大 4人から choice に対するレスポンスを待つ\\\nユーザからではなく、controller が優先順位を考慮して遷移させる必要がある\\\n通知する choice がない場合、controller が\\*で遷移させる",
          on: {
            RON: {
              target: "roned",
              guard: "canWin",
            },
            PON: {
              target: "poned",
              guard: "canPon",
            },
            CHI: {
              target: "chied",
              guard: "canChi",
            },
            DAI_KAN: {
              target: "dai_kaned",
            },
            "*": {
              target: "wildcard_after_discarded",
            },
          },
        },
        reached: {
          on: {
            NEXT: {
              target: "waiting_user_event_after_discarded",
              actions: {
                type: "notify_choice_after_discarded",
              },
            },
          },
          entry: {
            type: "notify_reach_accepted",
          },
        },
        roned: {
          exit: [
            {
              type: "notify_ron",
            },
            {
              type: "notify_end",
            },
          ],
          type: "final",
        },
        poned: {
          on: {
            NEXT: {
              target: "waiting_discard_event",
              actions: {
                type: "notify_choice_after_called",
              },
            },
          },
          entry: [
            {
              type: "notify_call",
            },
            {
              type: "disable_none_shot",
            },
          ],
        },
        chied: {
          on: {
            NEXT: {
              target: "waiting_discard_event",
              actions: {
                type: "notify_choice_after_called",
                params: { action: "chi" },
              },
            },
          },
          entry: [
            {
              type: "notify_call",
            },
            {
              type: "disable_one_shot",
            },
          ],
        },
        wildcard_after_discarded: {
          exit: [],
          always: [
            {
              target: "drawn_game",
              guard: "cannotContinue",
            },
            {
              target: "drawn",
              actions: [
                {
                  type: "updateNextWind",
                },
              ],
            },
          ],
        },
        waiting_discard_event: {
          description: "鳴いたユーザからの DISCARD イベントを待つ",
          on: {
            DISCARD: {
              target: "discarded",
            },
          },
        },
        dai_kaned: {
          on: {
            NEXT: {
              target: "waiting_user_event_after_drawn",
              actions: [
                {
                  type: "notify_draw",
                  params: { action: "kan" },
                },
                {
                  type: "notify_choice_after_drawn",
                  params: { replacementWin: true },
                },
              ],
            },
          },
          entry: [
            {
              type: "notify_call",
            },
            {
              type: "disable_one_shot",
            },
          ],
        },
        an_sho_kaned: {
          // FIXME
          // on Next は動作しない。具体的に notify_choice_for_chankan を Next で実行する必要があるが
          // Next 時には、kan されたコンテキスト（誰がどのブロックでカンされたか失われてしまっている。
          always: {
            target: "waiting_chankan_event",
          },
          entry: [
            {
              type: "notify_call",
            },
            {
              type: "disable_one_shot",
            },
            {
              type: "notify_new_dora_if_needed",
            },
            {
              type: "notify_choice_for_chankan",
            },
          ],
        },
        waiting_chankan_event: {
          description: "チャンカンを待つ",
          on: {
            "*": {
              target: "waiting_user_event_after_drawn",
              actions: [
                {
                  type: "notify_draw",
                  params: {
                    action: "kan",
                  },
                },
                {
                  type: "notify_choice_after_drawn",
                  params: {
                    replacementWin: true,
                  },
                },
              ],
            },
            RON: {
              target: "roned",
              guard: {
                type: "canWin",
              },
            },
          },
        },
        drawn_game: {
          exit: {
            type: "notify_end",
            params: {},
          },
          type: "final",
        },
      },
      types: {
        events: {} as
          | { type: "" }
          | { type: "NEXT" }
          | { type: "CHI"; block: BlockChi; iam: Wind }
          | { type: "PON"; block: BlockPon; iam: Wind }
          | {
              type: "RON";
              ret: WinResult;
              iam: Wind;
              targetInfo: { wind: Wind; tile: Tile };
              quadWin?: boolean;
            }
          | { type: "TSUMO"; ret: WinResult; iam: Wind; lastTile: Tile }
          | { type: "REACH"; tile: Tile; iam: Wind }
          | { type: "REACH_ACCEPT"; reacherInfo: { tile: Tile; wind: Wind } }
          | { type: "DISCARD"; tile: Tile; iam: Wind }
          | { type: "AN_KAN"; block: BlockAnKan; iam: Wind }
          | { type: "SHO_KAN"; block: BlockShoKan; iam: Wind }
          | { type: "DAI_KAN"; block: BlockDaiKan; iam: Wind }
          | { type: "DRAWN_GAME_BY_NINE_ORPHANS"; iam: Wind },
        context: {} as ControllerContext,
      },
    },
    {
      actions: {
        updateNextWind: ({ context, event }) => {
          const cur = context.currentWind;
          context.currentWind = nextWind(cur);
        },
        notify_distribution: ({ context, event }) => {
          const id = context.genEventID();
          const initHands = context.controller.initialHands();
          for (const w of Object.values(WIND)) {
            const hands = createWindMap("_____________");
            hands[w] = initHands[w].toString();
            const e = {
              id: id,
              type: "DISTRIBUTE" as const,
              hands: hands,
              wind: w,
              doraMarker: context.controller.wall.doraMarkers[0].toString(),
              sticks: context.controller.placeManager.sticks,
              round: context.controller.placeManager.round,
              players: context.controller.playerIDs,
              places: context.controller.placeManager.playerMap,
              scores: context.controller.scoreManager.summary,
            };
            context.controller.emit(e);
          }
          context.controller.next();
        },
        notify_choice_after_drawn: ({ context, event }, params) => {
          const w = context.currentWind;
          const drawn = context.controller.hand(w).drawn;
          const id = context.genEventID();
          const e: ChoiceAfterDrawnEvent = {
            id: id,
            type: "CHOICE_AFTER_DRAWN" as const,
            wind: w,
            drawerInfo: { wind: w, tile: drawn!.toString() },
            choices: {
              TSUMO: serializeWinResultOrFalse(
                context.controller.doWin(w, drawn, {
                  oneShot: context.oneShotMap[w],
                  replacementWin: (
                    params as { replacementWin: boolean } | undefined
                  )?.replacementWin,
                })
              ),
              REACH: serializeCandidate(context.controller.doReach(w)),
              AN_KAN: serializeBlocksOrFalse(context.controller.doAnKan(w)),
              SHO_KAN: serializeBlocksOrFalse(context.controller.doShoKan(w)),
              DISCARD: context.controller.doDiscard(w).map((v) => v.toString()),
              DRAWN_GAME_BY_NINE_ORPHANS: context.controller.canDrawnGame(w),
            },
          };
          context.controller.emit(e);
          context.controller.pollReplies(id, [w]);
        },
        notify_choice_after_discarded: ({ context, event }) => {
          const id = context.genEventID();
          const discarded = context.controller.river.lastTile;
          const ltile = discarded.t.clone({ add: OP.HORIZONTAL });
          for (const w of Object.values(WIND)) {
            const e: ChoiceAfterDiscardedEvent = {
              id: id,
              type: "CHOICE_AFTER_DISCARDED" as const,
              wind: w,
              discarterInfo: {
                wind: discarded.w,
                tile: discarded.t.toString(),
              },
              choices: {
                RON: serializeWinResultOrFalse(
                  context.controller.doWin(w, ltile, {
                    discardedBy: discarded.w,
                    oneShot: context.oneShotMap[w],
                    missingRon: context.missingMap[w],
                  })
                ),
                PON: serializeBlocksOrFalse(
                  context.controller.doPon(w, discarded.w, ltile)
                ),
                CHI: serializeBlocksOrFalse(
                  context.controller.doChi(w, discarded.w, ltile)
                ),
                DAI_KAN: serializeBlockOrFalse(
                  context.controller.doDaiKan(w, discarded.w, ltile)
                ),
              },
            };
            if (e.choices.RON) context.missingMap[w] = true; // ロン可能であればフリテンをtrueにする。次のツモ番で解除される想定
            // TODO if no choice, skip enqueue
            context.controller.emit(e);
          }
          // TODO skip not euqueued winds
          context.controller.pollReplies(id, Object.values(WIND));
        },
        notify_choice_after_called: ({ context, event }, params) => {
          const id = context.genEventID();
          const w = context.currentWind;
          let discard = context.controller.doDiscard(w);

          const called = context.controller
            .hand(context.currentWind)
            .called.at(-1);
          if (called instanceof BlockChi || called instanceof BlockPon)
            discard = context.controller.doDiscard(w, called);
          const e = {
            id: id,
            type: "CHOICE_AFTER_CALLED" as const,
            wind: w,
            choices: {
              DISCARD: discard.map((v) => v.toString()),
            },
          };
          context.controller.emit(e);
          context.controller.pollReplies(id, [w]);
        },
        notify_choice_for_reach_acceptance: ({ context, event }) => {
          const id = context.genEventID();
          const discarded = context.controller.river.lastTile;
          const ltile = discarded.t.clone({ add: OP.HORIZONTAL });
          for (const w of Object.values(WIND)) {
            const e: ChoiceForReachAcceptance = {
              id: id,
              type: "CHOICE_FOR_REACH_ACCEPTANCE",
              wind: w,
              reacherInfo: { wind: discarded.w, tile: ltile.toString() },
              choices: {
                RON: serializeWinResultOrFalse(
                  context.controller.doWin(w, ltile, {
                    discardedBy: discarded.w,
                    oneShot: context.oneShotMap[w],
                    missingRon: context.missingMap[w],
                  })
                ),
              },
            };
            context.controller.emit(e);
          }
          context.controller.pollReplies(id, Object.values(WIND));
        },
        notify_choice_for_chankan: ({ context, event }) => {
          assert(
            event.type == "SHO_KAN" || event.type == "AN_KAN",
            `unexpected event ${event.type}`
          );
          const id = context.genEventID();
          const t = event.block.tiles[0].clone({ remove: OP.HORIZONTAL });
          for (const w of Object.values(WIND)) {
            const ron = context.controller.doWin(
              w,
              event.block.tiles[0].clone({ remove: OP.HORIZONTAL }),
              {
                discardedBy: event.iam,
                quadWin: true,
                oneShot: context.oneShotMap[w],
                missingRon: context.missingMap[event.iam],
              }
            );
            const e: ChoiceForChanKan = {
              id: id,
              type: "CHOICE_FOR_CHAN_KAN",
              wind: w,
              callerInfo: { wind: event.iam, tile: t.toString() },
              choices: {
                RON:
                  event.type == "SHO_KAN"
                    ? serializeWinResultOrFalse(ron)
                    : false,
              },
            };
            if (e.choices.RON) context.missingMap[w] = true; // ロン可能であればフリテンをtrueにする。次のツモ番で解除される想定
            context.controller.emit(e);
          }
          context.controller.pollReplies(id, Object.values(WIND));
        },
        notify_call: ({ context, event }) => {
          assert(
            event.type == "CHI" ||
              event.type == "PON" ||
              event.type == "DAI_KAN" ||
              event.type == "AN_KAN" ||
              event.type == "SHO_KAN",
            `unexpected event ${event.type}`
          );
          const id = context.genEventID();
          const iam = event.iam;
          context.currentWind = iam; // update current wind
          for (const w of Object.values(WIND)) {
            const e = {
              id: id,
              type: event.type,
              iam: iam,
              wind: w,
              block: event.block.serialize(),
            };
            context.controller.emit(e);
          }
          context.controller.next();
        },
        notify_discard: ({ context, event }) => {
          assert(event.type == "DISCARD", `unexpected event ${event.type}`);
          const id = context.genEventID();
          const iam = context.currentWind;
          const t = event.tile;
          for (const w of Object.values(WIND)) {
            const e = {
              id: id,
              type: "DISCARD" as const,
              iam: iam,
              wind: w,
              tile: t.toString(),
            };
            context.controller.emit(e);
          }
          context.controller.next();
        },
        notify_draw: ({ context, event }, params) => {
          const id = context.genEventID();

          const action = (params as { action: string } | undefined)?.action; // TODO avoid as
          let drawn: Tile | undefined = undefined;
          if (action == "kan") drawn = context.controller.wall.kan();
          else drawn = context.controller.wall.draw();

          const iam = context.currentWind;

          // リーチしてなければフリテンを解除
          if (!context.controller.hand(iam).reached)
            context.missingMap[iam] = false;

          for (const w of Object.values(WIND)) {
            let t = new Tile(TYPE.BACK, 0, [OP.TSUMO]); // mask tile for other players
            if (w == iam) t = drawn;
            const e = {
              id: id,
              type: "DRAW" as const,
              subType: action,
              iam: iam,
              wind: w,
              tile: t.toString(),
            };
            context.controller.emit(e);
          }
          context.controller.next();
        },
        notify_ron: ({ context, event }) => {
          assert(event.type == "RON");
          const id = context.genEventID();
          const iam = event.iam;
          for (const w of Object.values(WIND)) {
            const e: RonEvent = {
              id: id,
              type: event.type,
              iam: iam,
              wind: w,
              victimInfo: {
                wind: event.targetInfo.wind,
                tile: event.targetInfo.tile.toString(),
              },
              ret: serializeWinResult(event.ret),
            };
            context.controller.emit(e);
          }
        },
        notify_tsumo: ({ context, event }) => {
          assert(event.type == "TSUMO", `unexpected event ${event.type}`);
          const id = context.genEventID();
          const iam = context.currentWind;
          for (const w of Object.values(WIND)) {
            const e = {
              id: id,
              type: event.type,
              iam: iam,
              wind: w,
              lastTile: context.controller.hand(iam).drawn!.toString(),
              ret: serializeWinResult(event.ret),
            };
            context.controller.emit(e);
          }
        },
        notify_reach: ({ context, event }) => {
          assert(event.type == "REACH", `unexpected event ${event.type}`);
          const id = context.genEventID();
          const iam = event.iam;
          const t = event.tile.clone({ add: OP.HORIZONTAL });
          context.oneShotMap[iam] = true; // enable one shot
          for (const w of Object.values(WIND)) {
            const e: ReachEvent = {
              id: id,
              type: event.type,
              iam: iam,
              wind: w,
              tile: t.toString(),
            };
            context.controller.emit(e);
          }
        },
        notify_reach_accepted: ({ context, event }) => {
          assert(event.type == "REACH_ACCEPT");
          const id = context.genEventID();
          for (const w of Object.values(WIND)) {
            const e: ReachAcceptedEvent = {
              id: id,
              type: "REACH_ACCEPTED",
              reacherInfo: {
                wind: event.reacherInfo.wind,
                tile: event.reacherInfo.tile.toString(),
              },
              wind: w,
            };
            context.controller.emit(e);
          }
          context.controller.next();
        },
        notify_new_dora_if_needed: ({ context, event }) => {
          const id = context.genEventID();
          if (event.type == "AN_KAN") {
            const tile = context.controller.wall.openDoraMarker();
            for (const w of Object.values(WIND)) {
              const e = {
                id: id,
                type: "NEW_DORA" as const,
                wind: w,
                doraMarker: tile.toString(),
              };
              context.controller.emit(e);
            }
          }
          if (event.type == "SHO_KAN") {
            // nothing because handling by discarded
          }
        },
        disable_one_shot: ({ context, event }) => {
          for (const w of Object.values(WIND)) context.oneShotMap[w] = false;
        },
        disable_one_shot_for_me: ({ context, event }) => {
          context.oneShotMap[context.currentWind] = false;
        },
        notify_end: ({ context, event }) => {
          const id = context.genEventID();
          const hands = createWindMap("");
          if (event.type == "DRAWN_GAME_BY_NINE_ORPHANS") {
            hands[event.iam] = context.controller.hand(event.iam).toString();
            for (const w of Object.values(WIND)) {
              const e = {
                id: id,
                type: "END_GAME" as const,
                subType: "NINE_TILES" as const,
                wind: w,
                shouldContinue: true,
                sticks: context.controller.placeManager.sticks,
                scores: context.controller.scoreManager.summary,
                deltas: createWindMap(0),
                hands: hands,
              };
              context.controller.emit(e);
            }
          } else if (event.type == "RON" || event.type == "TSUMO") {
            const shouldContinue = event.iam == WIND.E;
            const finalResults = context.controller.finalResult(
              event.ret,
              event.iam
            );
            for (const w of Object.values(WIND)) {
              hands[event.iam] = context.controller.hand(event.iam).toString();
              const e = {
                id: id,
                type: "END_GAME" as const,
                subType: "WIN_GAME" as const,
                wind: w,
                shouldContinue: shouldContinue,
                sticks: { reach: 0, dead: 0 },
                scores: context.controller.scoreManager.summary,
                deltas: finalResults.deltas,
                hands: hands,
              };
              context.controller.emit(e);
            }
          } else if (
            !context.controller.wall.canKan ||
            context.controller.river.cannotContinue()
          ) {
            const subType = !context.controller.wall.canKan
              ? ("FOUR_KAN" as const)
              : ("FOUR_WIND" as const);
            for (const w of Object.values(WIND)) {
              const e = {
                id: id,
                type: "END_GAME" as const,
                subType: subType,
                wind: w,
                shouldContinue: true,
                sticks: context.controller.placeManager.sticks,
                scores: context.controller.scoreManager.summary,
                deltas: createWindMap(0),
                hands: createWindMap(""),
              };
              context.controller.emit(e);
            }
          } else if (!context.controller.wall.canDraw) {
            const wind: Wind[] = [];
            // TODO ノーテン宣言ありなら notify_choice_event_for_ready/waiting_ready_eventを追加する必要あり
            for (const w of Object.values(WIND)) {
              const hand = context.controller.hand(w);
              const shan = new ShantenCalculator(hand).calc();
              if (shan == 0) {
                wind.push(w);
                hands[w] = hand.toString();
              }
            }

            const nothing = wind.length == 0 || wind.length == 4;
            const deltas = createWindMap(0);
            for (const w of Object.values(WIND)) {
              if (wind.includes(w))
                deltas[w] += nothing ? 0 : 3000 / wind.length;
              else deltas[w] -= nothing ? 0 : 3000 / (4 - wind.length);
            }

            const shouldContinue = wind.length == 4 || deltas[WIND.E] > 0;
            for (const w of Object.values(WIND)) {
              const e = {
                id: id,
                type: "END_GAME" as const,
                subType: "DRAWN_GAME" as const,
                wind: w,
                shouldContinue: shouldContinue,
                sticks: context.controller.placeManager.sticks,
                scores: context.controller.scoreManager.summary,
                deltas: deltas,
                hands: hands,
              };
              context.controller.emit(e);
            }
          } else throw new Error(`unexpected event ${event.type}`);
        },
      },
      actors: {},
      guards: {
        canChi: ({ context, event }, params) => {
          if (event.type == "CHI")
            return !!context.controller.doChi(
              event.iam,
              context.controller.river.lastTile.w,
              context.controller.river.lastTile.t
            );
          console.error(`guards.canChi receive ${event.type}`);
          return false;
        },
        canPon: ({ context, event }, params) => {
          if (event.type == "PON")
            return !!context.controller.doPon(
              event.iam,
              context.controller.river.lastTile.w,
              context.controller.river.lastTile.t
            );
          console.error(`guards.canPon receive ${event.type}`);
          return false;
        },
        canWin: ({ context, event }, params) => {
          if (event.type == "TSUMO" || event.type == "RON") {
            return true; // TODO
          }
          console.error(`guards.canWin receive ${event.type}`);
          return false;
        },
        canReach: ({ context, event }, params) => {
          if (event.type == "REACH") {
            return !!context.controller.doReach(event.iam);
          }
          console.error(`guards.canReach receive ${event.type}`);
          return false;
        },
        cannotContinue: ({ context, event }, params) => {
          return (
            !context.controller.wall.canDraw ||
            !context.controller.wall.canKan ||
            context.controller.river.cannotContinue()
          );
        },
      },
      delays: {},
    }
  );
};

export function incrementalIDGenerator(start = 0) {
  let idx = start;
  return () => {
    return (idx++).toString();
  };
}
