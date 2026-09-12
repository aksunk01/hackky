import type { Language } from "./languages";

export type TestCase = {
  args: unknown[];
  expected: unknown;
};

/**
 * The shape of a function's inputs and output. Python and JavaScript ignore
 * this, but the statically typed runners need it to declare each test case's
 * arguments and to print the return value back as JSON.
 */
export type ValueType = "int" | "bool" | "string" | "int[]" | "int[][]";

export type Problem = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  funcName: string;
  /**
   * Every problem offers all six languages: paramTypes/returnType (both
   * always given together) tell the four statically typed runners how to
   * declare each test case's arguments and print the return value back out.
   */
  starterCode: Partial<Record<Language, string>>;
  paramTypes?: ValueType[];
  returnType?: ValueType;
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
    paramTypes: ["int[]", "int"],
    returnType: "int[]",
    starterCode: {
      python: `def two_sum(nums, target):
    # your code here
    pass
`,
      javascript: `function two_sum(nums, target) {
  // your code here
}
`,
      cpp: `vector<int> two_sum(vector<int>& nums, int target) {
    // your code here
    return {};
}
`,
      c: `int* two_sum(int* nums, int numsSize, int target, int* returnSize) {
    // your code here
    *returnSize = 0;
    return NULL;
}
`,
      java: `class Solution {
    public int[] two_sum(int[] nums, int target) {
        // your code here
        return new int[0];
    }
}
`,
      csharp: `public class Solution {
    public int[] two_sum(int[] nums, int target) {
        // your code here
        return new int[0];
    }
}
`,
    },
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
    paramTypes: ["string"],
    returnType: "bool",
    starterCode: {
      python: `def is_valid(s):
    # your code here
    pass
`,
      javascript: `function is_valid(s) {
  // your code here
}
`,
      cpp: `bool is_valid(string s) {
    // your code here
    return false;
}
`,
      c: `bool is_valid(char* s) {
    // your code here
    return false;
}
`,
      java: `class Solution {
    public boolean is_valid(String s) {
        // your code here
        return false;
    }
}
`,
      csharp: `public class Solution {
    public bool is_valid(string s) {
        // your code here
        return false;
    }
}
`,
    },
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
    paramTypes: ["int[][]"],
    returnType: "int[][]",
    starterCode: {
      python: `def merge(intervals):
    # your code here
    pass
`,
      javascript: `function merge(intervals) {
  // your code here
}
`,
      cpp: `vector<vector<int>> merge(vector<vector<int>>& intervals) {
    // your code here
    return {};
}
`,
      c: `int** merge(int** intervals, int intervalsSize, int* intervalsColSize,
            int* returnSize, int** returnColumnSizes) {
    // your code here
    *returnSize = 0;
    *returnColumnSizes = NULL;
    return NULL;
}
`,
      java: `class Solution {
    public int[][] merge(int[][] intervals) {
        // your code here
        return new int[0][0];
    }
}
`,
      csharp: `public class Solution {
    public int[][] merge(int[][] intervals) {
        // your code here
        return new int[0][];
    }
}
`,
    },
    testCases: [
      {
        args: [[[1, 3], [2, 6], [8, 10], [15, 18]]],
        expected: [[1, 6], [8, 10], [15, 18]],
      },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[1, 4], [0, 4]]], expected: [[0, 4]] },
    ],
  },
  {
    id: "longest-substring-without-repeating",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    tags: "Strings / Sliding Window",
    description:
      "Given a string s, find the length of the longest substring without repeating characters.",
    examples: [
      { input: 's = "abcabcbb"', output: "3", explanation: 'The answer is "abc", with length 3.' },
      { input: 's = "bbbbb"', output: "1" },
      { input: 's = "pwwkew"', output: "3" },
    ],
    constraints: [
      "0 <= s.length <= 5 * 10^4",
      "s consists of English letters, digits, symbols, and spaces.",
    ],
    funcName: "length_of_longest_substring",
    paramTypes: ["string"],
    returnType: "int",
    starterCode: {
      python: `def length_of_longest_substring(s):
    # your code here
    pass
`,
      javascript: `function length_of_longest_substring(s) {
  // your code here
}
`,
      cpp: `int length_of_longest_substring(string s) {
    // your code here
    return 0;
}
`,
      c: `int length_of_longest_substring(char* s) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int length_of_longest_substring(String s) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int length_of_longest_substring(string s) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: ["abcabcbb"], expected: 3 },
      { args: ["bbbbb"], expected: 1 },
      { args: ["pwwkew"], expected: 3 },
      { args: [""], expected: 0 },
      { args: ["dvdf"], expected: 3 },
    ],
  },
  {
    id: "longest-palindromic-substring",
    title: "Longest Palindromic Substring",
    difficulty: "Medium",
    tags: "Strings / Dynamic Programming",
    description:
      "Given a string s, return the longest palindromic substring in s. If more than one substring of the maximum length exists, return the one that starts earliest in s.",
    examples: [
      { input: 's = "babad"', output: '"bab"', explanation: '"aba" is also valid, but "bab" starts earlier.' },
      { input: 's = "cbbd"', output: '"bb"' },
    ],
    constraints: ["1 <= s.length <= 1000", "s consists of digits and English letters."],
    funcName: "longest_palindrome",
    paramTypes: ["string"],
    returnType: "string",
    starterCode: {
      python: `def longest_palindrome(s):
    # your code here
    pass
`,
      javascript: `function longest_palindrome(s) {
  // your code here
}
`,
      cpp: `string longest_palindrome(string s) {
    // your code here
    return "";
}
`,
      c: `char* longest_palindrome(char* s) {
    // your code here
    return "";
}
`,
      java: `class Solution {
    public String longest_palindrome(String s) {
        // your code here
        return "";
    }
}
`,
      csharp: `public class Solution {
    public string longest_palindrome(string s) {
        // your code here
        return "";
    }
}
`,
    },
    testCases: [
      { args: ["babad"], expected: "bab" },
      { args: ["cbbd"], expected: "bb" },
      { args: ["a"], expected: "a" },
      { args: ["ac"], expected: "a" },
    ],
  },
  {
    id: "multiply-strings",
    title: "Multiply Strings",
    difficulty: "Medium",
    tags: "Strings / Math",
    description:
      "Given two non-negative integers num1 and num2 represented as strings, return the product of num1 and num2, also represented as a string. You must not convert the inputs directly to integers or use a built-in big-integer type.",
    examples: [
      { input: 'num1 = "2", num2 = "3"', output: '"6"' },
      { input: 'num1 = "123", num2 = "456"', output: '"56088"' },
    ],
    constraints: [
      "1 <= num1.length, num2.length <= 200",
      "num1 and num2 consist of digits only.",
      "Neither num1 nor num2 has leading zeros, except the number 0 itself.",
    ],
    funcName: "multiply",
    paramTypes: ["string", "string"],
    returnType: "string",
    starterCode: {
      python: `def multiply(num1, num2):
    # your code here
    pass
`,
      javascript: `function multiply(num1, num2) {
  // your code here
}
`,
      cpp: `string multiply(string num1, string num2) {
    // your code here
    return "";
}
`,
      c: `char* multiply(char* num1, char* num2) {
    // your code here
    return "";
}
`,
      java: `class Solution {
    public String multiply(String num1, String num2) {
        // your code here
        return "";
    }
}
`,
      csharp: `public class Solution {
    public string multiply(string num1, string num2) {
        // your code here
        return "";
    }
}
`,
    },
    testCases: [
      { args: ["2", "3"], expected: "6" },
      { args: ["123", "456"], expected: "56088" },
      { args: ["0", "12"], expected: "0" },
      { args: ["99", "99"], expected: "9801" },
    ],
  },
  {
    id: "backspace-string-compare",
    title: "Backspace String Compare",
    difficulty: "Easy",
    tags: "Strings / Stack",
    description:
      "Given two strings s and t, each representing a sequence of keystrokes where '#' means a backspace, return true if they're equal once the backspaces are applied.",
    examples: [
      { input: 's = "ab#c", t = "ad#c"', output: "true", explanation: 'Both become "ac".' },
      { input: 's = "ab##", t = "c#d#"', output: "true", explanation: "Both become the empty string." },
      { input: 's = "a#c", t = "b"', output: "false" },
    ],
    constraints: ["1 <= s.length, t.length <= 200", "s and t only contain lowercase letters and '#'."],
    funcName: "backspace_compare",
    paramTypes: ["string", "string"],
    returnType: "bool",
    starterCode: {
      python: `def backspace_compare(s, t):
    # your code here
    pass
`,
      javascript: `function backspace_compare(s, t) {
  // your code here
}
`,
      cpp: `bool backspace_compare(string s, string t) {
    // your code here
    return false;
}
`,
      c: `bool backspace_compare(char* s, char* t) {
    // your code here
    return false;
}
`,
      java: `class Solution {
    public boolean backspace_compare(String s, String t) {
        // your code here
        return false;
    }
}
`,
      csharp: `public class Solution {
    public bool backspace_compare(string s, string t) {
        // your code here
        return false;
    }
}
`,
    },
    testCases: [
      { args: ["ab#c", "ad#c"], expected: true },
      { args: ["ab##", "c#d#"], expected: true },
      { args: ["a#c", "b"], expected: false },
      { args: ["bxj##tw", "bxo#j##tw"], expected: true },
    ],
  },
  {
    id: "best-time-to-buy-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    tags: "Arrays / Dynamic Programming",
    description:
      "You are given an array prices where prices[i] is the price of a stock on day i. Choose a single day to buy and a later day to sell to maximize profit. Return the maximum profit, or 0 if no profit is possible.",
    examples: [
      { input: "prices = [7,1,5,3,6,4]", output: "5", explanation: "Buy on day 2 (price 1), sell on day 5 (price 6)." },
      { input: "prices = [7,6,4,3,1]", output: "0", explanation: "No profitable transaction is possible." },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    funcName: "max_profit",
    paramTypes: ["int[]"],
    returnType: "int",
    starterCode: {
      python: `def max_profit(prices):
    # your code here
    pass
`,
      javascript: `function max_profit(prices) {
  // your code here
}
`,
      cpp: `int max_profit(vector<int>& prices) {
    // your code here
    return 0;
}
`,
      c: `int max_profit(int* prices, int pricesSize) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int max_profit(int[] prices) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int max_profit(int[] prices) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5 },
      { args: [[7, 6, 4, 3, 1]], expected: 0 },
      { args: [[2, 4, 1]], expected: 2 },
      { args: [[1]], expected: 0 },
    ],
  },
  {
    id: "gas-station",
    title: "Gas Station",
    difficulty: "Medium",
    tags: "Arrays / Greedy",
    description:
      "There are n gas stations along a circular route. gas[i] is the gas available at station i, and cost[i] is the gas needed to drive from station i to station i + 1. Starting with an empty tank at one station, return the index of the starting station that lets you complete the circuit once, or -1 if none exists. A solution, if it exists, is unique.",
    examples: [
      { input: "gas = [1,2,3,4,5], cost = [3,4,5,1,2]", output: "3" },
      { input: "gas = [2,3,4], cost = [3,4,3]", output: "-1" },
    ],
    constraints: ["n == gas.length == cost.length", "1 <= n <= 10^5", "0 <= gas[i], cost[i] <= 10^4"],
    funcName: "can_complete_circuit",
    paramTypes: ["int[]", "int[]"],
    returnType: "int",
    starterCode: {
      python: `def can_complete_circuit(gas, cost):
    # your code here
    pass
`,
      javascript: `function can_complete_circuit(gas, cost) {
  // your code here
}
`,
      cpp: `int can_complete_circuit(vector<int>& gas, vector<int>& cost) {
    // your code here
    return -1;
}
`,
      c: `int can_complete_circuit(int* gas, int gasSize, int* cost, int costSize) {
    // your code here
    return -1;
}
`,
      java: `class Solution {
    public int can_complete_circuit(int[] gas, int[] cost) {
        // your code here
        return -1;
    }
}
`,
      csharp: `public class Solution {
    public int can_complete_circuit(int[] gas, int[] cost) {
        // your code here
        return -1;
    }
}
`,
    },
    testCases: [
      { args: [[1, 2, 3, 4, 5], [3, 4, 5, 1, 2]], expected: 3 },
      { args: [[2, 3, 4], [3, 4, 3]], expected: -1 },
      { args: [[3, 1, 1], [1, 2, 2]], expected: 0 },
      { args: [[5], [4]], expected: 0 },
    ],
  },
  {
    id: "minimum-absolute-difference",
    title: "Minimum Absolute Difference",
    difficulty: "Easy",
    tags: "Arrays / Sorting",
    description:
      "Given an array of distinct integers arr, find every pair of elements with the minimum absolute difference between any two elements. Return the pairs as [a, b] with a < b, sorted in ascending order by a.",
    examples: [
      { input: "arr = [4,2,1,3]", output: "[[1,2],[2,3],[3,4]]" },
      { input: "arr = [1,3,6,10,15]", output: "[[1,3]]" },
      { input: "arr = [3,8,-10,23,19,-4,-14,27]", output: "[[-14,-10],[19,23],[23,27]]" },
    ],
    constraints: ["2 <= arr.length <= 10^5", "-10^6 <= arr[i] <= 10^6", "All elements are distinct."],
    funcName: "minimum_abs_difference",
    paramTypes: ["int[]"],
    returnType: "int[][]",
    starterCode: {
      python: `def minimum_abs_difference(arr):
    # your code here
    pass
`,
      javascript: `function minimum_abs_difference(arr) {
  // your code here
}
`,
      cpp: `vector<vector<int>> minimum_abs_difference(vector<int>& arr) {
    // your code here
    return {};
}
`,
      c: `int** minimum_abs_difference(int* arr, int arrSize, int* returnSize, int** returnColumnSizes) {
    // your code here
    *returnSize = 0;
    *returnColumnSizes = NULL;
    return NULL;
}
`,
      java: `class Solution {
    public int[][] minimum_abs_difference(int[] arr) {
        // your code here
        return new int[0][0];
    }
}
`,
      csharp: `public class Solution {
    public int[][] minimum_abs_difference(int[] arr) {
        // your code here
        return new int[0][];
    }
}
`,
    },
    testCases: [
      { args: [[4, 2, 1, 3]], expected: [[1, 2], [2, 3], [3, 4]] },
      { args: [[1, 3, 6, 10, 15]], expected: [[1, 3]] },
      { args: [[3, 8, -10, 23, 19, -4, -14, 27]], expected: [[-14, -10], [19, 23], [23, 27]] },
    ],
  },
  {
    id: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    tags: "BFS/DFS / Matrix",
    description:
      "Given an m x n grid of integers where 1 represents land and 0 represents water, return the number of islands. An island is a group of 1's connected horizontally or vertically.",
    examples: [
      {
        input: "grid = [[1,1,1,1,0],[1,1,0,1,0],[1,1,0,0,0],[0,0,0,0,0]]",
        output: "1",
      },
      {
        input: "grid = [[1,1,0,0,0],[1,1,0,0,0],[0,0,1,0,0],[0,0,0,1,1]]",
        output: "3",
      },
    ],
    constraints: ["1 <= m, n <= 300", "grid[i][j] is 0 or 1."],
    funcName: "num_islands",
    paramTypes: ["int[][]"],
    returnType: "int",
    starterCode: {
      python: `def num_islands(grid):
    # your code here
    pass
`,
      javascript: `function num_islands(grid) {
  // your code here
}
`,
      cpp: `int num_islands(vector<vector<int>>& grid) {
    // your code here
    return 0;
}
`,
      c: `int num_islands(int** grid, int gridSize, int* gridColSize) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int num_islands(int[][] grid) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int num_islands(int[][] grid) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      {
        args: [[[1, 1, 1, 1, 0], [1, 1, 0, 1, 0], [1, 1, 0, 0, 0], [0, 0, 0, 0, 0]]],
        expected: 1,
      },
      {
        args: [[[1, 1, 0, 0, 0], [1, 1, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 1, 1]]],
        expected: 3,
      },
    ],
  },
  {
    id: "flood-fill",
    title: "Flood Fill",
    difficulty: "Easy",
    tags: "BFS/DFS / Matrix",
    description:
      "Given an image as an m x n grid of integers, a starting pixel (sr, sc), and a new color, replace the color of the starting pixel and every pixel connected to it (4-directionally) that shares its original color. Return the modified image.",
    examples: [
      { input: "image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, color = 2", output: "[[2,2,2],[2,2,0],[2,0,1]]" },
    ],
    constraints: ["1 <= m, n <= 50", "0 <= image[i][j], color < 65536", "0 <= sr < m", "0 <= sc < n"],
    funcName: "flood_fill",
    paramTypes: ["int[][]", "int", "int", "int"],
    returnType: "int[][]",
    starterCode: {
      python: `def flood_fill(image, sr, sc, color):
    # your code here
    pass
`,
      javascript: `function flood_fill(image, sr, sc, color) {
  // your code here
}
`,
      cpp: `vector<vector<int>> flood_fill(vector<vector<int>>& image, int sr, int sc, int color) {
    // your code here
    return {};
}
`,
      c: `int** flood_fill(int** image, int imageSize, int* imageColSize, int sr, int sc, int color,
                  int* returnSize, int** returnColumnSizes) {
    // your code here
    *returnSize = 0;
    *returnColumnSizes = NULL;
    return NULL;
}
`,
      java: `class Solution {
    public int[][] flood_fill(int[][] image, int sr, int sc, int color) {
        // your code here
        return new int[0][0];
    }
}
`,
      csharp: `public class Solution {
    public int[][] flood_fill(int[][] image, int sr, int sc, int color) {
        // your code here
        return new int[0][];
    }
}
`,
    },
    testCases: [
      { args: [[[1, 1, 1], [1, 1, 0], [1, 0, 1]], 1, 1, 2], expected: [[2, 2, 2], [2, 2, 0], [2, 0, 1]] },
      { args: [[[0, 0, 0], [0, 0, 0]], 0, 0, 0], expected: [[0, 0, 0], [0, 0, 0]] },
    ],
  },
  {
    id: "prefix-sum-array",
    title: "Prefix Sum Array",
    difficulty: "Easy",
    tags: "Arrays",
    description:
      "Given an array arr of size n, return its prefix sum array prefixSum of the same size, such that prefixSum[i] = arr[0] + arr[1] + ... + arr[i].",
    examples: [
      { input: "arr = [1,2,3,4]", output: "[1,3,6,10]" },
      { input: "arr = [5]", output: "[5]" },
    ],
    constraints: ["1 <= arr.length <= 10^5", "-10^4 <= arr[i] <= 10^4"],
    funcName: "prefix_sum",
    paramTypes: ["int[]"],
    returnType: "int[]",
    starterCode: {
      python: `def prefix_sum(arr):
    # your code here
    pass
`,
      javascript: `function prefix_sum(arr) {
  // your code here
}
`,
      cpp: `vector<int> prefix_sum(vector<int>& arr) {
    // your code here
    return {};
}
`,
      c: `int* prefix_sum(int* arr, int arrSize, int* returnSize) {
    // your code here
    *returnSize = 0;
    return NULL;
}
`,
      java: `class Solution {
    public int[] prefix_sum(int[] arr) {
        // your code here
        return new int[0];
    }
}
`,
      csharp: `public class Solution {
    public int[] prefix_sum(int[] arr) {
        // your code here
        return new int[0];
    }
}
`,
    },
    testCases: [
      { args: [[1, 2, 3, 4]], expected: [1, 3, 6, 10] },
      { args: [[5]], expected: [5] },
      { args: [[2, -1, 3, -2]], expected: [2, 1, 4, 2] },
      { args: [[0, 0, 0]], expected: [0, 0, 0] },
    ],
  },
  {
    id: "next-greater-element",
    title: "Next Greater Element",
    difficulty: "Medium",
    tags: "Arrays / Monotonic Stack",
    description:
      "Given an array of integers nums, return an array result where result[i] is the next element to the right of index i that is strictly greater than nums[i]. If no such element exists, result[i] should be -1.",
    examples: [
      { input: "nums = [4,5,2,25]", output: "[5,25,25,-1]" },
      { input: "nums = [13,7,6,12]", output: "[-1,12,12,-1]" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
    funcName: "next_greater_elements",
    paramTypes: ["int[]"],
    returnType: "int[]",
    starterCode: {
      python: `def next_greater_elements(nums):
    # your code here
    pass
`,
      javascript: `function next_greater_elements(nums) {
  // your code here
}
`,
      cpp: `vector<int> next_greater_elements(vector<int>& nums) {
    // your code here
    return {};
}
`,
      c: `int* next_greater_elements(int* nums, int numsSize, int* returnSize) {
    // your code here
    *returnSize = 0;
    return NULL;
}
`,
      java: `class Solution {
    public int[] next_greater_elements(int[] nums) {
        // your code here
        return new int[0];
    }
}
`,
      csharp: `public class Solution {
    public int[] next_greater_elements(int[] nums) {
        // your code here
        return new int[0];
    }
}
`,
    },
    testCases: [
      { args: [[4, 5, 2, 25]], expected: [5, 25, 25, -1] },
      { args: [[13, 7, 6, 12]], expected: [-1, 12, 12, -1] },
      { args: [[1, 2, 3, 4]], expected: [2, 3, 4, -1] },
      { args: [[4, 3, 2, 1]], expected: [-1, -1, -1, -1] },
    ],
  },
  {
    id: "car-pooling",
    title: "Car Pooling",
    difficulty: "Medium",
    tags: "Arrays / Line Sweep",
    description:
      "You drive a car heading east with a given capacity of empty seats. trips[i] = [numPassengers, from, to] means you must pick up numPassengers at location from and drop them off at location to (from < to). Given trips and capacity, return true if it's possible to pick up and drop off every passenger without the car ever exceeding capacity.",
    examples: [
      { input: "trips = [[2,1,5],[3,3,7]], capacity = 4", output: "false" },
      { input: "trips = [[2,1,5],[3,3,7]], capacity = 5", output: "true" },
    ],
    constraints: [
      "1 <= trips.length <= 1000",
      "trips[i].length == 3",
      "1 <= capacity <= 10^5",
    ],
    funcName: "car_pooling",
    paramTypes: ["int[][]", "int"],
    returnType: "bool",
    starterCode: {
      python: `def car_pooling(trips, capacity):
    # your code here
    pass
`,
      javascript: `function car_pooling(trips, capacity) {
  // your code here
}
`,
      cpp: `bool car_pooling(vector<vector<int>>& trips, int capacity) {
    // your code here
    return false;
}
`,
      c: `bool car_pooling(int** trips, int tripsSize, int* tripsColSize, int capacity) {
    // your code here
    return false;
}
`,
      java: `class Solution {
    public boolean car_pooling(int[][] trips, int capacity) {
        // your code here
        return false;
    }
}
`,
      csharp: `public class Solution {
    public bool car_pooling(int[][] trips, int capacity) {
        // your code here
        return false;
    }
}
`,
    },
    testCases: [
      { args: [[[2, 1, 5], [3, 3, 7]], 4], expected: false },
      { args: [[[2, 1, 5], [3, 3, 7]], 5], expected: true },
      { args: [[[3, 1, 5], [2, 2, 6]], 4], expected: false },
    ],
  },
  {
    id: "sum-of-subarray-ranges",
    title: "Sum of Subarray Ranges",
    difficulty: "Medium",
    tags: "Arrays / Monotonic Stack",
    description:
      "The range of a subarray is the difference between the largest and smallest elements in it. Given an integer array nums, return the sum of the ranges of all its contiguous subarrays.",
    examples: [
      { input: "nums = [1,2,3]", output: "4", explanation: "Ranges: [1]=0,[2]=0,[3]=0,[1,2]=1,[2,3]=1,[1,2,3]=2, total 4." },
      { input: "nums = [4,-2,-3,4,1]", output: "59" },
    ],
    constraints: ["1 <= nums.length <= 1000", "-10^9 <= nums[i] <= 10^9"],
    funcName: "sub_array_ranges",
    paramTypes: ["int[]"],
    returnType: "int",
    starterCode: {
      python: `def sub_array_ranges(nums):
    # your code here
    pass
`,
      javascript: `function sub_array_ranges(nums) {
  // your code here
}
`,
      cpp: `int sub_array_ranges(vector<int>& nums) {
    // your code here
    return 0;
}
`,
      c: `int sub_array_ranges(int* nums, int numsSize) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int sub_array_ranges(int[] nums) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int sub_array_ranges(int[] nums) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: [[1, 2, 3]], expected: 4 },
      { args: [[4, -2, -3, 4, 1]], expected: 59 },
      { args: [[1, 3, 3]], expected: 4 },
    ],
  },
  {
    id: "longest-holiday-subarray",
    title: "Longest Holiday Subarray",
    difficulty: "Medium",
    tags: "Arrays / Sliding Window",
    description:
      "You're given a string days made of 'w' (work day) and 'h' (holiday), and an integer h representing how many work days you're allowed to convert into holidays. Return the length of the longest contiguous substring that can be made entirely of holidays using at most h conversions.",
    examples: [
      { input: 'days = "wwhhwwhhww", h = 2', output: "6" },
      { input: 'days = "wwww", h = 0', output: "0" },
    ],
    constraints: ["1 <= days.length <= 10^5", "0 <= h <= days.length"],
    funcName: "longest_holiday_subarray",
    paramTypes: ["string", "int"],
    returnType: "int",
    starterCode: {
      python: `def longest_holiday_subarray(days, h):
    # your code here
    pass
`,
      javascript: `function longest_holiday_subarray(days, h) {
  // your code here
}
`,
      cpp: `int longest_holiday_subarray(string days, int h) {
    // your code here
    return 0;
}
`,
      c: `int longest_holiday_subarray(char* days, int h) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int longest_holiday_subarray(String days, int h) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int longest_holiday_subarray(string days, int h) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: ["wwhhwwhhww", 2], expected: 6 },
      { args: ["hhwwwhhhww", 1], expected: 4 },
      { args: ["wwww", 0], expected: 0 },
      { args: ["hhhh", 5], expected: 4 },
    ],
  },
  {
    id: "basic-calculator-ii",
    title: "Basic Calculator II",
    difficulty: "Medium",
    tags: "Strings / Stack",
    description:
      "Given a string s representing a non-negative integer expression with +, -, *, / and spaces (no parentheses), evaluate it and return the result. Integer division truncates toward zero.",
    examples: [
      { input: 's = "3+2*2"', output: "7" },
      { input: 's = " 3/2 "', output: "1" },
      { input: 's = " 3+5 / 2 "', output: "5" },
    ],
    constraints: [
      "1 <= s.length <= 3 * 10^5",
      "s consists of integers and the operators '+','-','*','/' with spaces.",
    ],
    funcName: "calculate",
    paramTypes: ["string"],
    returnType: "int",
    starterCode: {
      python: `def calculate(s):
    # your code here
    pass
`,
      javascript: `function calculate(s) {
  // your code here
}
`,
      cpp: `int calculate(string s) {
    // your code here
    return 0;
}
`,
      c: `int calculate(char* s) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int calculate(String s) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int calculate(string s) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: ["3+2*2"], expected: 7 },
      { args: [" 3/2 "], expected: 1 },
      { args: [" 3+5 / 2 "], expected: 5 },
    ],
  },
  {
    id: "max-occurrences-of-a-substring",
    title: "Maximum Number of Occurrences of a Substring",
    difficulty: "Medium",
    tags: "Strings / Sliding Window",
    description:
      "Given a string s, return the maximum number of occurrences of any substring under these rules: the number of unique characters in the substring must be <= maxLetters, and its size must be between minSize and maxSize inclusive.",
    examples: [
      { input: 's = "aababcaab", maxLetters = 2, minSize = 3, maxSize = 4', output: "2" },
      { input: 's = "aaaa", maxLetters = 1, minSize = 3, maxSize = 3', output: "2" },
    ],
    constraints: [
      "1 <= s.length <= 10^5",
      "1 <= maxLetters <= 26",
      "1 <= minSize <= maxSize <= min(26, s.length)",
    ],
    funcName: "max_freq",
    paramTypes: ["string", "int", "int", "int"],
    returnType: "int",
    starterCode: {
      python: `def max_freq(s, maxLetters, minSize, maxSize):
    # your code here
    pass
`,
      javascript: `function max_freq(s, maxLetters, minSize, maxSize) {
  // your code here
}
`,
      cpp: `int max_freq(string s, int maxLetters, int minSize, int maxSize) {
    // your code here
    return 0;
}
`,
      c: `int max_freq(char* s, int maxLetters, int minSize, int maxSize) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int max_freq(String s, int maxLetters, int minSize, int maxSize) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int max_freq(string s, int maxLetters, int minSize, int maxSize) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: ["aababcaab", 2, 3, 4], expected: 2 },
      { args: ["aaaa", 1, 3, 3], expected: 2 },
    ],
  },
  {
    id: "min-flips-heads-before-tails",
    title: "Minimum Flips for Heads Before Tails",
    difficulty: "Medium",
    tags: "Strings / Dynamic Programming",
    description:
      "Given a string s of 'H' and 'T' characters representing a sequence of coin flips, return the minimum number of characters you need to flip so that every 'H' comes before every 'T' in the resulting string.",
    examples: [
      { input: 's = "HTTHHT"', output: "2" },
      { input: 's = "HHTTHH"', output: "2" },
    ],
    constraints: ["1 <= s.length <= 10^5", "s consists only of 'H' and 'T'."],
    funcName: "min_flips",
    paramTypes: ["string"],
    returnType: "int",
    starterCode: {
      python: `def min_flips(s):
    # your code here
    pass
`,
      javascript: `function min_flips(s) {
  // your code here
}
`,
      cpp: `int min_flips(string s) {
    // your code here
    return 0;
}
`,
      c: `int min_flips(char* s) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int min_flips(String s) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int min_flips(string s) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: ["HTTHHT"], expected: 2 },
      { args: ["HHTTHH"], expected: 2 },
      { args: ["H"], expected: 0 },
      { args: ["T"], expected: 0 },
    ],
  },
  {
    id: "merge-two-sorted-arrays",
    title: "Merge Two Sorted Streams",
    difficulty: "Easy",
    tags: "Arrays / Two Pointers",
    description:
      "Given two arrays a and b, each already sorted in ascending order, merge them into a single sorted array.",
    examples: [
      { input: "a = [1,3,5], b = [2,4,6]", output: "[1,2,3,4,5,6]" },
      { input: "a = [], b = [1]", output: "[1]" },
    ],
    constraints: ["0 <= a.length, b.length <= 10^5", "-10^9 <= a[i], b[i] <= 10^9"],
    funcName: "merge_sorted_arrays",
    paramTypes: ["int[]", "int[]"],
    returnType: "int[]",
    starterCode: {
      python: `def merge_sorted_arrays(a, b):
    # your code here
    pass
`,
      javascript: `function merge_sorted_arrays(a, b) {
  // your code here
}
`,
      cpp: `vector<int> merge_sorted_arrays(vector<int>& a, vector<int>& b) {
    // your code here
    return {};
}
`,
      c: `int* merge_sorted_arrays(int* a, int aSize, int* b, int bSize, int* returnSize) {
    // your code here
    *returnSize = 0;
    return NULL;
}
`,
      java: `class Solution {
    public int[] merge_sorted_arrays(int[] a, int[] b) {
        // your code here
        return new int[0];
    }
}
`,
      csharp: `public class Solution {
    public int[] merge_sorted_arrays(int[] a, int[] b) {
        // your code here
        return new int[0];
    }
}
`,
    },
    testCases: [
      { args: [[1, 3, 5], [2, 4, 6]], expected: [1, 2, 3, 4, 5, 6] },
      { args: [[], [1]], expected: [1] },
      { args: [[1, 1, 2], [1, 3]], expected: [1, 1, 1, 2, 3] },
    ],
  },
  {
    id: "course-schedule",
    title: "Course Schedule",
    difficulty: "Medium",
    tags: "Graphs / Topological Sort",
    description:
      "There are numCourses courses labeled 0 to numCourses - 1. You're given prerequisites where prerequisites[i] = [a, b] means you must take course b before course a. Given numCourses and prerequisites, return true if you can finish all courses, or false if it's impossible (i.e. the prerequisites contain a cycle).",
    examples: [
      { input: "numCourses = 2, prerequisites = [[1,0]]", output: "true" },
      {
        input: "numCourses = 2, prerequisites = [[1,0],[0,1]]",
        output: "false",
        explanation: "To take course 1 you need course 0, and to take course 0 you need course 1 — a cycle.",
      },
    ],
    constraints: [
      "1 <= numCourses <= 2000",
      "0 <= prerequisites.length <= 5000",
      "prerequisites[i].length == 2",
    ],
    funcName: "can_finish",
    paramTypes: ["int", "int[][]"],
    returnType: "bool",
    starterCode: {
      python: `def can_finish(numCourses, prerequisites):
    # your code here
    pass
`,
      javascript: `function can_finish(numCourses, prerequisites) {
  // your code here
}
`,
      cpp: `bool can_finish(int numCourses, vector<vector<int>>& prerequisites) {
    // your code here
    return false;
}
`,
      c: `bool can_finish(int numCourses, int** prerequisites, int prerequisitesSize, int* prerequisitesColSize) {
    // your code here
    return false;
}
`,
      java: `class Solution {
    public boolean can_finish(int numCourses, int[][] prerequisites) {
        // your code here
        return false;
    }
}
`,
      csharp: `public class Solution {
    public bool can_finish(int numCourses, int[][] prerequisites) {
        // your code here
        return false;
    }
}
`,
    },
    testCases: [
      { args: [2, [[1, 0]]], expected: true },
      { args: [2, [[1, 0], [0, 1]]], expected: false },
      { args: [1, []], expected: true },
      { args: [3, [[1, 0], [2, 1]]], expected: true },
    ],
  },
];

/**
 * The argument names as the candidate sees them, read off the Python starter's
 * signature since every problem has one (`def two_sum(nums, target):`).
 */
export function paramNames(problem: Problem): string[] {
  const match = /def\s+\w+\s*\(([^)]*)\)/.exec(problem.starterCode.python ?? "");
  const names = (match?.[1] ?? "")
    .split(",")
    .map((part) => part.trim().split(/[:=]/)[0]!.trim())
    .filter(Boolean);
  const count = problem.testCases[0]?.args.length ?? names.length;
  return Array.from({ length: count }, (_, i) => names[i] ?? `arg${i + 1}`);
}

export function getProblem(id: string): Problem | undefined {
  return problems.find((p) => p.id === id);
}
