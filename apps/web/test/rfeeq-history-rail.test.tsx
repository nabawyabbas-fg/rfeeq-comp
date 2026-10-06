import { HistoryRail } from "@/components/rfeeq/shell/history-rail";
import { conversationTitle } from "@/lib/rfeeq/chat-title";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * A history rail is scanned vertically. Panning it sideways to read the end of
 * one title moves every other row with it, which is why a long name truncates
 * and is offered whole on hover instead.
 */
const LONG = "ما تفسير الآية 43 من سورة النحل؟";

const rail = () =>
  renderToStaticMarkup(
    <HistoryRail
      grouped={[
        {
          key: "today",
          label: "اليوم",
          chats: [{ id: "a", title: LONG, updatedAt: new Date().toISOString() }],
        },
      ]}
      chats={[{ id: "a", title: LONG, updatedAt: new Date().toISOString() }]}
      noMatches={false}
      activeChatId={null}
      onOpen={() => undefined}
      onRename={() => undefined}
      onDelete={() => undefined}
    />,
  );

describe("a long conversation name", () => {
  it("truncates rather than widening its row", () => {
    const html = rail();
    expect(html).toContain("truncate");
    // the title button is the only thing that may grow, and it may not grow
    // past its column
    expect(html).toContain("min-w-0");
  });

  /*
   * What truncation costs, given back: the rail owes the reader recognition,
   * and the whole string on demand.
   */
  it("offers the whole name on hover", () => {
    expect(rail()).toContain(`title="${LONG}"`);
  });

  /*
   * The row condenses the name it shows; the question itself is never dropped
   * from the markup, so hover and assistive tech still reach the real wording.
   */
  it("never loses the question itself", () => {
    expect(rail()).toContain(LONG);
  });
});

/**
 * The regression that hid the row actions.
 *
 * A bare `grid` gets one auto track sized to the longest title's max-content,
 * every row fills that track instead of the rail, and the rename and delete
 * buttons — which sit at the row's end — land outside it. Visible only as a
 * horizontal scrollbar until the rail stopped scrolling sideways, at which
 * point they were simply gone.
 */
describe("the rail's own width", () => {
  it("caps its column at the rail rather than at the longest title", () => {
    const html = rail();
    expect(html).toContain("grid grid-cols-1");
    expect(html).not.toMatch(/class="grid gap-px"/);
  });

  it("keeps both row actions inside the row", () => {
    const html = rail();
    expect(html).toContain(`aria-label="إعادة تسمية «${LONG}»"`);
    expect(html).toContain(`aria-label="حذف «${LONG}»"`);
    // they may never be the thing that gives when the row is tight
    expect(html).toMatch(/shrink-0[^"]*size-8/);
  });
});

/**
 * What the rail is for: telling one conversation from another.
 *
 * The stored title is the question verbatim, and Arabic questions in this
 * domain share a long opening stem — twelve verse questions all read «ما تفسير
 * الآية … من سور…» at the width a rail has. The name shown is condensed so the
 * distinguishing part comes first; the question itself stays stored, searched
 * and available on hover.
 */
describe("the name a row shows", () => {
  it("puts the sūra and number first, where the row can show them", () => {
    expect(conversationTitle("ما تفسير الآية 43 من سورة النحل؟")).toBe(
      "تفسير النحل ٤٣",
    );
    expect(conversationTitle("ما تفسير الآية ٣٥ من سورة النور؟")).toBe(
      "تفسير النور ٣٥",
    );
  });

  it("tells two verse questions apart inside the row's width", () => {
    const nahl = conversationTitle("ما تفسير الآية 43 من سورة النحل؟");
    const anbiya = conversationTitle("ما تفسير الآية 43 من سورة الأنبياء؟");
    expect(nahl).not.toBe(anbiya);
    // both legible in the ~22 characters a 272px rail shows
    expect(nahl.length).toBeLessThan(22);
    expect(anbiya.length).toBeLessThan(22);
  });

  it("drops the word حديث, which the row's icon already carries", () => {
    expect(conversationTitle("ما صحة حديث «اطلبوا العلم ولو بالصين»؟")).toBe(
      "صحة «اطلبوا العلم ولو بالصين»",
    );
  });

  /*
   * Conservative on purpose: a name the reader typed is theirs, and an opener
   * whose removal would leave a fragment is left where it is.
   */
  it("leaves a hand-written name exactly as it was written", () => {
    expect(conversationTitle("رحلتي إلى الحج")).toBe("رحلتي إلى الحج");
  });

  it("keeps «هل», which is short and carries the question", () => {
    expect(conversationTitle("هل يجوز الجمع بين الصلاتين؟")).toBe(
      "هل يجوز الجمع بين الصلاتين",
    );
  });

  it("never returns an empty name", () => {
    expect(conversationTitle(null)).toBe("محادثة");
    expect(conversationTitle("   ")).toBe("محادثة");
    expect(conversationTitle("؟")).toBe("؟");
  });

  it("shows the condensed name in the row and the question on hover", () => {
    const html = rail();
    expect(html).toContain("تفسير النحل ٤٣");
    expect(html).toContain(`title="${LONG}"`);
  });
});
