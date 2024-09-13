import { TYPE } from "../core/constants";
import { Tile } from "../core/parser";
import { shuffle } from "./managers";

export interface WallProps {
  drawable: string[];
  dead: string[];
  replacement: string[];
  doraMarkers: string[];
  blindDoraMarkers: string[];
}

export class Wall {
  private walls: WallProps = {
    replacement: [],
    dead: [],
    doraMarkers: [],
    blindDoraMarkers: [],
    drawable: [],
  };
  private backup: WallProps;
  private openedDoraCount = 1;
  constructor(backup?: WallProps) {
    this.init(backup);
    this.backup = Wall.clone(this.walls);
  }
  kan() {
    if (this.walls.replacement.length == 0)
      throw new Error(`exceeded maximum kan`);
    const t = this.walls.replacement.pop()!;
    this.walls.drawable.pop();
    return Tile.from(t);
  }
  draw() {
    if (!this.walls.drawable) throw new Error("cannot draw any more");
    return Tile.from(this.walls.drawable.pop()!);
  }

  openDoraMarker() {
    if (this.openedDoraCount >= 4)
      throw new Error("exceeded maximum open dora");
    this.openedDoraCount++;
    return Tile.from(this.walls.doraMarkers[this.openedDoraCount - 1]);
  }
  get doraMarkers() {
    return this.walls.doraMarkers.slice(0, this.openedDoraCount).map(Tile.from);
  }
  get blindDoraMarkers() {
    return this.walls.blindDoraMarkers
      .slice(0, this.openedDoraCount)
      .map(Tile.from);
  }
  get canKan() {
    return this.walls.replacement.length > 0;
  }
  get canDraw() {
    return this.walls.drawable.length > 0;
  }

  private init(backup?: WallProps) {
    if (backup != null) {
      this.walls = Wall.clone(backup);
      return;
    } else {
      for (let t of Object.values(TYPE)) {
        if (t == TYPE.BACK) continue;
        const values =
          t == TYPE.Z ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
        for (let i = 0; i < 4; i++) {
          for (let n of values) {
            if (t != TYPE.Z && i == 3 && n == 5) n = 0;
            this.walls.drawable.push(new Tile(t, n).toString());
          }
        }
      }
      shuffle(this.walls.drawable);
    }

    for (let i = 0; i < 14; i++) {
      this.walls.dead.push(this.walls.drawable.pop()!);
    }
    for (let i = 0; i < 4; i++) {
      this.walls.blindDoraMarkers.push(this.walls.dead.pop()!);
    }
    for (let i = 0; i < 4; i++) {
      this.walls.doraMarkers.push(this.walls.dead.pop()!);
    }
    for (let i = 0; i < 4; i++) {
      this.walls.replacement.push(this.walls.dead.pop()!);
    }
  }
  export() {
    return this.backup;
  }
  static clone(walls: WallProps): WallProps {
    return {
      drawable: walls.drawable.concat(),
      dead: walls.dead.concat(),
      doraMarkers: walls.doraMarkers.concat(),
      blindDoraMarkers: walls.blindDoraMarkers.concat(),
      replacement: walls.replacement.concat(),
    };
  }
}
