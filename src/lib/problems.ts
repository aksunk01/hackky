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
   * Every problem has Python (and, mechanically, JavaScript). The statically
   * typed languages are only wired up where paramTypes/returnType are also
   * given — until then the picker simply doesn't offer them for that problem.
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
    starterCode: {
      python: `def length_of_longest_substring(s):
    # your code here
    pass
`,
      javascript: `function length_of_longest_substring(s) {
  // your code here
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
    starterCode: {
      python: `def longest_palindrome(s):
    # your code here
    pass
`,
      javascript: `function longest_palindrome(s) {
  // your code here
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
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    tags: "Strings / Hash Map",
    description:
      "Given an array of strings strs, group the anagrams together. Return the groups as a list of lists: sort the words inside each group alphabetically, then sort the groups by their first word.",
    examples: [
      {
        input: 'strs = ["eat","tea","tan","ate","nat","bat"]',
        output: '[["ate","eat","tea"],["bat"],["nat","tan"]]',
      },
    ],
    constraints: [
      "1 <= strs.length <= 10^4",
      "0 <= strs[i].length <= 100",
      "strs[i] consists of lowercase English letters.",
    ],
    funcName: "group_anagrams",
    starterCode: {
      python: `def group_anagrams(strs):
    # your code here
    pass
`,
      javascript: `function group_anagrams(strs) {
  // your code here
}
`,
    },
    testCases: [
      {
        args: [["eat", "tea", "tan", "ate", "nat", "bat"]],
        expected: [["ate", "eat", "tea"], ["bat"], ["nat", "tan"]],
      },
      { args: [[""]], expected: [[""]] },
      { args: [["a"]], expected: [["a"]] },
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
    starterCode: {
      python: `def backspace_compare(s, t):
    # your code here
    pass
`,
      javascript: `function backspace_compare(s, t) {
  // your code here
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
    starterCode: {
      python: `def max_profit(prices):
    # your code here
    pass
`,
      javascript: `function max_profit(prices) {
  // your code here
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
    starterCode: {
      python: `def can_complete_circuit(gas, cost):
    # your code here
    pass
`,
      javascript: `function can_complete_circuit(gas, cost) {
  // your code here
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
    starterCode: {
      python: `def minimum_abs_difference(arr):
    # your code here
    pass
`,
      javascript: `function minimum_abs_difference(arr) {
  // your code here
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
      "Given an m x n grid where '1' represents land and '0' represents water, return the number of islands. An island is a group of '1's connected horizontally or vertically.",
    examples: [
      {
        input: 'grid = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]',
        output: "1",
      },
      {
        input: 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
        output: "3",
      },
    ],
    constraints: ["1 <= m, n <= 300", "grid[i][j] is '0' or '1'."],
    funcName: "num_islands",
    starterCode: {
      python: `def num_islands(grid):
    # your code here
    pass
`,
      javascript: `function num_islands(grid) {
  // your code here
}
`,
    },
    testCases: [
      {
        args: [[["1", "1", "1", "1", "0"], ["1", "1", "0", "1", "0"], ["1", "1", "0", "0", "0"], ["0", "0", "0", "0", "0"]]],
        expected: 1,
      },
      {
        args: [[["1", "1", "0", "0", "0"], ["1", "1", "0", "0", "0"], ["0", "0", "1", "0", "0"], ["0", "0", "0", "1", "1"]]],
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
    starterCode: {
      python: `def flood_fill(image, sr, sc, color):
    # your code here
    pass
`,
      javascript: `function flood_fill(image, sr, sc, color) {
  // your code here
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
    starterCode: {
      python: `def prefix_sum(arr):
    # your code here
    pass
`,
      javascript: `function prefix_sum(arr) {
  // your code here
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
    starterCode: {
      python: `def next_greater_elements(nums):
    # your code here
    pass
`,
      javascript: `function next_greater_elements(nums) {
  // your code here
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
    starterCode: {
      python: `def car_pooling(trips, capacity):
    # your code here
    pass
`,
      javascript: `function car_pooling(trips, capacity) {
  // your code here
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
    starterCode: {
      python: `def sub_array_ranges(nums):
    # your code here
    pass
`,
      javascript: `function sub_array_ranges(nums) {
  // your code here
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
      "You're given a char array days made of 'w' (work day) and 'h' (holiday), and an integer h representing how many work days you're allowed to convert into holidays. Return the length of the longest contiguous subarray that can be made entirely of holidays using at most h conversions.",
    examples: [
      { input: 'days = "wwhhwwhhww", h = 2', output: "6" },
      { input: 'days = "wwww", h = 0', output: "0" },
    ],
    constraints: ["1 <= days.length <= 10^5", "0 <= h <= days.length"],
    funcName: "longest_holiday_subarray",
    starterCode: {
      python: `def longest_holiday_subarray(days, h):
    # your code here
    pass
`,
      javascript: `function longest_holiday_subarray(days, h) {
  // your code here
}
`,
    },
    testCases: [
      { args: [["w", "w", "h", "h", "w", "w", "h", "h", "w", "w"], 2], expected: 6 },
      { args: [["h", "h", "w", "w", "w", "h", "h", "h", "w", "w"], 1], expected: 4 },
      { args: [["w", "w", "w", "w"], 0], expected: 0 },
      { args: [["h", "h", "h", "h"], 5], expected: 4 },
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
    starterCode: {
      python: `def calculate(s):
    # your code here
    pass
`,
      javascript: `function calculate(s) {
  // your code here
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
    starterCode: {
      python: `def max_freq(s, maxLetters, minSize, maxSize):
    # your code here
    pass
`,
      javascript: `function max_freq(s, maxLetters, minSize, maxSize) {
  // your code here
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
    starterCode: {
      python: `def min_flips(s):
    # your code here
    pass
`,
      javascript: `function min_flips(s) {
  // your code here
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
    starterCode: {
      python: `def merge_sorted_arrays(a, b):
    # your code here
    pass
`,
      javascript: `function merge_sorted_arrays(a, b) {
  // your code here
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
    id: "alien-dictionary",
    title: "Alien Dictionary",
    difficulty: "Hard",
    tags: "Graphs / Topological Sort",
    description:
      "Given a list of words from an alien language, sorted lexicographically by that language's unknown alphabet, derive the order of characters. Return a string of the unique letters in that order. When multiple letters have no remaining ordering constraint at some step, break the tie by choosing the lexicographically smallest one (standard English order) — every test case here has exactly one answer under that rule. Return an empty string if the input is invalid (e.g. contradictory ordering, or a later word that is a prefix of an earlier one).",
    examples: [
      { input: 'words = ["wrt","wrf","er","ett","rftt"]', output: '"wertf"' },
      { input: 'words = ["z","x"]', output: '"zx"' },
      { input: 'words = ["z","x","z"]', output: '""', explanation: "Contradiction: z < x and x < z can't both hold." },
    ],
    constraints: ["1 <= words.length <= 100", "words[i] consists of lowercase English letters."],
    funcName: "alien_order",
    starterCode: {
      python: `def alien_order(words):
    # your code here
    pass
`,
      javascript: `function alien_order(words) {
  // your code here
}
`,
    },
    testCases: [
      { args: [["wrt", "wrf", "er", "ett", "rftt"]], expected: "wertf" },
      { args: [["z", "x"]], expected: "zx" },
      { args: [["z", "x", "z"]], expected: "" },
    ],
  },
];

export function getProblem(id: string): Problem | undefined {
  return problems.find((p) => p.id === id);
}
