import { expect, test } from "vitest";
import { stripAnsi } from "../src/main/utils";

test("stripAnsi removes basic ANSI codes", () => {
  const input = "\x1B[31mHello\x1B[0m World";
  expect(stripAnsi(input)).toBe("Hello World");
});

test("stripAnsi removes complex ANSI codes", () => {
  const input = "\x1B]0;title\x07\x1B[1;32mGreen\x1B[0m";
  // The regex correctly strips the entire OSC sequence (\x1B]... \x07)
  expect(stripAnsi(input)).toBe("Green");
});

test("stripAnsi removes \r", () => {
  const input = "Line 1\rLine 2";
  expect(stripAnsi(input)).toBe("Line 1Line 2");
});
