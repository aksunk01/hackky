export type TestCase = {
  args: unknown[];
  expected: unknown;
};

export type Problem = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  funcName: string;
  starterCode: string;
  testCases: TestCase[];
};

export const problems: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    tags: "Arrays / Hash Map",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input has exactly one solution, and you may not use the same element twice.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "Exactly one valid answer exists.",
    ],
    funcName: "two_sum",
    starterCode: `def two_sum(nums, target):
    # your code here
    pass
`,
    testCases: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[1, 5, 3, 8], 11], expected: [2, 3] },
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    tags: "Stack",
    description:
      "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Brackets must close in the correct order and every close must have a matching open.",
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "([)]"', output: "false" },
    ],
    constraints: ["1 <= s.length <= 10^4", "s consists only of bracket characters."],
    funcName: "is_valid",
    starterCode: `def is_valid(s):
    # your code here
    pass
`,
    testCases: [
      { args: ["()"], expected: true },
      { args: ["()[]{}"], expected: true },
      { args: ["(]"], expected: false },
      { args: ["([)]"], expected: false },
      { args: ["{[]}"], expected: true },
    ],
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    tags: "Arrays / Sorting",
    description:
      "Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input. Return the result sorted by start.",
    examples: [
      {
        input: "intervals = [[1,3],[2,6],[8,10],[15,18]]",
        output: "[[1,6],[8,10],[15,18]]",
      },
      { input: "intervals = [[1,4],[4,5]]", output: "[[1,5]]" },
    ],
    constraints: ["1 <= intervals.length <= 10^4", "intervals[i].length == 2"],
    funcName: "merge",
    starterCode: `def merge(intervals):
    # your code here
    pass
`,
    testCases: [
      {
        args: [[[1, 3], [2, 6], [8, 10], [15, 18]]],
        expected: [[1, 6], [8, 10], [15, 18]],
      },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[1, 4], [0, 4]]], expected: [[0, 4]] },
    ],
  },
];

export function getProblem(id: string): Problem | undefined {
  return problems.find((p) => p.id === id);
}
