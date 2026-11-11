import { FLOOR_LABS } from "@/components/perception/perception-lab";
import {
  getExhibitionsOnFloor,
  getFloors,
  getMovements,
  getStation,
  getStationMovements,
  getWorldsOnFloor,
} from "@/lib/museum/registry";
import { type Building, buildBuilding } from "@/lib/walk/building";

/** The whole museum as a building, from the registry. Server-side; the result is plain data. */
export function museumBuilding(): Building {
  return buildBuilding({
    floors: getFloors(),
    exhibitionsOn: getExhibitionsOnFloor,
    movements: getMovements(),
    labs: [...FLOOR_LABS],
    worlds: Object.fromEntries(
      getFloors().map((f) => [
        f.slug,
        getWorldsOnFloor(f).map((w) => ({ slug: w.slug, title: w.title, blurb: w.intro })),
      ]),
    ),
    stations: Object.fromEntries(getStationMovements().map((m) => [m, getStation(m)!])),
  });
}
