import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../lib/markdown";
import { renderRich, looksLikeRich } from "../lib/rich-text";

describe("markdown renderer", () => {
  it("renders bold and italic", () => {
    const html = renderMarkdown("This is **bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders unordered lists", () => {
    const html = renderMarkdown("- one\n- two\n- three");
    expect(html).toContain("<ul");
    expect(html.match(/<li>/g)?.length).toBe(3);
  });

  it("renders code fences", () => {
    const html = renderMarkdown("```js\nconst x = 1;\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("const x = 1;");
  });

  it("escapes raw HTML", () => {
    const html = renderMarkdown("<script>bad</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("rich text renderer", () => {
  it("detects math + code as rich", () => {
    expect(looksLikeRich("$x^2$")).toBe(true);
    expect(looksLikeRich("`code`")).toBe(true);
    expect(looksLikeRich("Plain prose with no markup")).toBe(false);
  });

  it("renders inline math as superscripts", () => {
    const html = renderRich("$x^2 + y^2$");
    expect(html).toContain("<sup>2</sup>");
  });

  it("renders fenced code with syntax classes", () => {
    const html = renderRich("```python\nreturn 1\n```");
    expect(html).toContain("<pre");
    expect(html).toContain("python");
  });
});
