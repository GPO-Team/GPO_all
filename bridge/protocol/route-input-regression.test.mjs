import { expect, it } from "vitest";
import validation from "./route-validation.cjs";
it("rejects empty, null and boolean coordinates instead of turning them into the origin", () => {
  for (const x of [null, true, false, "", "  "]) {
    expect(() => validation.validatePoints([{ x, y: 1 }])).toThrow();
  }
  expect(validation.validatePoints([{x:"1.25",y:"-2.5"}])).toEqual([{x:1.25,y:-2.5}]);
});
