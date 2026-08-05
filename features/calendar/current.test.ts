import { describe, expect, it } from "vitest";

import { pickCurrentTerm } from "./current";

// The server applies this when a year is made current; the confirm dialog shows
// its answer beforehand. If the two ever disagree, the dialog promises one term
// and the app switches to another — hence one shared, tested rule.
describe("pickCurrentTerm", () => {
  const term = (name: string, isCurrent = false) => ({ name, isCurrent });

  it("takes the earliest term when none is current", () => {
    const terms = [term("Term 1"), term("Term 2"), term("Term 3")];
    expect(pickCurrentTerm(terms)?.name).toBe("Term 1");
  });

  it("keeps a term that is already current in this year", () => {
    const terms = [term("Term 1"), term("Term 2", true), term("Term 3")];
    expect(pickCurrentTerm(terms)?.name).toBe("Term 2");
  });

  it("keeps the current one even when it is the last term", () => {
    const terms = [term("Term 1"), term("Term 2"), term("Term 4", true)];
    expect(pickCurrentTerm(terms)?.name).toBe("Term 4");
  });

  it("returns null for a year with no terms", () => {
    expect(pickCurrentTerm([])).toBeNull();
  });

  it("handles a single term", () => {
    expect(pickCurrentTerm([term("Term 1")])?.name).toBe("Term 1");
  });
});
