import type { Problem } from "@/lib/types";

export const MEDIUM_PROBLEMS: Problem[] = [
  {
    id: "longest-substring-without-repeating",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "medium",
    category: "Sliding Window",
    description: [
      "Given a string `s`, find the length of the longest substring that contains no repeating characters.",
      "A substring is a contiguous run of characters — `\"ace\"` is a subsequence of `\"abcde\"` but not a substring.",
    ],
    examples: [
      {
        input: 's = "abcabcbb"',
        output: "3",
        explanation: 'The answer is "abc", with length 3.',
      },
      {
        input: 's = "bbbbb"',
        output: "1",
        explanation: 'The answer is "b".',
      },
      {
        input: 's = "pwwkew"',
        output: "3",
        explanation: 'The answer is "wke". Note "pwke" is a subsequence, not a substring.',
      },
    ],
    constraints: [
      "0 <= s.length <= 5 * 10^4",
      "s consists of English letters, digits, symbols and spaces.",
    ],
    functionName: "lengthOfLongestSubstring",
    paramNames: ["s"],
    paramTypes: ["string"],
    returnType: "int",
    compare: "exact",
    starter: {
      java: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Write your solution here
        return 0;
    }
}`,
      python: `def lengthOfLongestSubstring(s):
    # Write your solution here
    pass`,
      javascript: `function lengthOfLongestSubstring(s) {
  // Write your solution here
}`,
    },
    tests: [
      { args: ["abcabcbb"], expected: 3, label: "basic" },
      { args: ["bbbbb"], expected: 1, label: "all identical" },
      { args: ["pwwkew"], expected: 3, label: "substring vs subsequence" },
      { args: [""], expected: 0, hidden: true, label: "empty string" },
      { args: [" "], expected: 1, hidden: true, label: "single space" },
      { args: ["au"], expected: 2, hidden: true, label: "two distinct" },
      { args: ["dvdf"], expected: 3, hidden: true, label: "window must not shrink backwards" },
      { args: ["abba"], expected: 2, hidden: true, label: "stale index trap" },
      { args: ["tmmzuxt"], expected: 5, hidden: true, label: "repeat outside the window" },
      {
        args: ["abcdefghij".repeat(3000)],
        expected: 10,
        hidden: true,
        label: "large input (rejects O(n^2))",
      },
    ],
    notes: {
      optimal:
        "Sliding window with a map from character to its last index. Move the right edge one character at a time; when you hit a repeat, jump the left edge to one past the previous occurrence, but never backwards.",
      optimalTime: "O(n)",
      optimalSpace: "O(min(n, alphabet))",
      bruteForce:
        "Check every substring for uniqueness, keeping the longest that passes.",
      bruteForceTime: "O(n^3), or O(n^2) with an incremental set",
      pitfalls: [
        "Moving the left pointer backwards on a stale index — 'abba' returns 3 instead of 2.",
        "Clearing the whole set on a repeat instead of shrinking the window.",
        "Confusing substring with subsequence and returning 4 for 'pwwkew'.",
      ],
      followUps: [
        "What is the space complexity, and how does it change if the input is restricted to lowercase letters?",
        "How would you also return the substring itself, not just its length?",
        "What if you were allowed at most k repeats inside the window?",
      ],
      clarifications: [
        "Can the string be empty?",
        "What character set should I assume — ASCII or full Unicode?",
        "Do I need to return the substring or just its length?",
      ],
      hints: {
        l1: "When you find a repeated character, what do you actually know about where a valid substring can start?",
        l2: "Every substring you care about is a contiguous window. Instead of restarting, can you just move the left edge of the window?",
        l3: "Keep a map of character to last seen index, and slide the left edge to one past that index when you hit a repeat.",
        l4: "left = 0, best = 0. For each right: if s[right] is in the map and its index >= left, set left = index + 1. Store s[right] -> right and update best = max(best, right - left + 1). The >= left check is what stops the window shrinking backwards.",
      },
    },
  },

  {
    id: "product-of-array-except-self",
    title: "Product of Array Except Self",
    difficulty: "medium",
    category: "Arrays",
    description: [
      "Given an integer array `nums`, return an array `answer` such that `answer[i]` is equal to the product of every element of `nums` except `nums[i]`.",
      "You must write an algorithm that runs in O(n) time and does so **without using the division operator**.",
    ],
    examples: [
      { input: "nums = [1,2,3,4]", output: "[24,12,8,6]" },
      { input: "nums = [-1,1,0,-3,3]", output: "[0,0,9,0,0]" },
    ],
    constraints: [
      "2 <= nums.length <= 10^5",
      "-30 <= nums[i] <= 30",
      "The product of any prefix or suffix of nums fits in a 32-bit integer.",
    ],
    functionName: "productExceptSelf",
    paramNames: ["nums"],
    paramTypes: ["int[]"],
    returnType: "int[]",
    compare: "exact",
    starter: {
      java: `class Solution {
    public int[] productExceptSelf(int[] nums) {
        // Write your solution here
        return new int[]{};
    }
}`,
      python: `def productExceptSelf(nums):
    # Write your solution here
    pass`,
      javascript: `function productExceptSelf(nums) {
  // Write your solution here
}`,
    },
    tests: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6], label: "basic" },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0], label: "contains a zero" },
      { args: [[2, 3]], expected: [3, 2], label: "two elements" },
      { args: [[0, 0]], expected: [0, 0], hidden: true, label: "two zeroes" },
      { args: [[1, 0]], expected: [0, 1], hidden: true, label: "one zero" },
      { args: [[5, 1, 2]], expected: [2, 10, 5], hidden: true, label: "contains a one" },
      { args: [[-1, -1, -1]], expected: [1, 1, 1], hidden: true, label: "all negative" },
      { args: [[1, 2, 0, 4, 0]], expected: [0, 0, 0, 0, 0], hidden: true, label: "two zeroes, spread out" },
    ],
    notes: {
      optimal:
        "Two passes. First fill the output with the running product of everything to the left of each index, then sweep right to left multiplying in the running product of everything to the right.",
      optimalTime: "O(n)",
      optimalSpace: "O(1) extra, not counting the output array",
      bruteForce:
        "For each index, multiply every other element with an inner loop.",
      bruteForceTime: "O(n^2)",
      pitfalls: [
        "Reaching for total product divided by nums[i] — explicitly banned, and it breaks on zeroes anyway.",
        "Special-casing zeroes with a counter, which works but is far more code than the prefix/suffix sweep.",
        "Allocating separate prefix and suffix arrays and then claiming O(1) space.",
      ],
      followUps: [
        "Suppose division were allowed. What would you write, and what input would break it?",
        "Is your solution O(1) extra space? Does the output array count?",
        "What if the array were streamed and you could not go back over it?",
      ],
      clarifications: [
        "Am I allowed to use division?",
        "Does the output array count towards the space complexity?",
        "Can the array contain zeroes?",
      ],
      hints: {
        l1: "The product of everything except index i splits naturally into two pieces. What are they?",
        l2: "It is the product of everything to the left of i times the product of everything to the right of i. Could you precompute those?",
        l3: "Do one left-to-right pass storing the running prefix product, then one right-to-left pass multiplying in the running suffix product.",
        l4: "Fill answer[i] with the product of nums[0..i-1] going forwards. Then walk backwards with a running variable right = 1, doing answer[i] *= right and right *= nums[i]. That reuses the output array, so no extra allocation.",
      },
    },
  },

  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "medium",
    category: "Hash Maps",
    description: [
      "Given an array of strings `strs`, group the anagrams together. You may return the answer in any order, and the strings within each group may be in any order.",
      "An anagram is a word formed by rearranging the letters of another, using all the original letters exactly once.",
    ],
    examples: [
      {
        input: 'strs = ["eat","tea","tan","ate","nat","bat"]',
        output: '[["bat"],["nat","tan"],["ate","eat","tea"]]',
      },
      { input: 'strs = [""]', output: '[[""]]' },
      { input: 'strs = ["a"]', output: '[["a"]]' },
    ],
    constraints: [
      "1 <= strs.length <= 10^4",
      "0 <= strs[i].length <= 100",
      "strs[i] consists of lowercase English letters.",
    ],
    functionName: "groupAnagrams",
    paramNames: ["strs"],
    paramTypes: ["string[]"],
    returnType: "string[][]",
    compare: "setOfSets",
    starter: {
      java: `class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        // Write your solution here
        return new ArrayList<>();
    }
}`,
      python: `def groupAnagrams(strs):
    # Write your solution here
    pass`,
      javascript: `function groupAnagrams(strs) {
  // Write your solution here
}`,
    },
    tests: [
      {
        args: [["eat", "tea", "tan", "ate", "nat", "bat"]],
        expected: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]],
        label: "basic",
      },
      { args: [[""]], expected: [[""]], label: "single empty string" },
      { args: [["a"]], expected: [["a"]], label: "single letter" },
      { args: [["", ""]], expected: [["", ""]], hidden: true, label: "two empty strings group together" },
      {
        args: [["abc", "bca", "cab", "xyz", "zyx"]],
        expected: [["abc", "bca", "cab"], ["xyz", "zyx"]],
        hidden: true,
        label: "two groups",
      },
      {
        args: [["a", "b", "c"]],
        expected: [["a"], ["b"], ["c"]],
        hidden: true,
        label: "no anagrams at all",
      },
      {
        args: [["aab", "aba", "baa", "aabb"]],
        expected: [["aab", "aba", "baa"], ["aabb"]],
        hidden: true,
        label: "repeated letters, different lengths",
      },
    ],
    notes: {
      optimal:
        "Hash map keyed by a canonical form of each word. Either the sorted letters, or a 26-slot character count rendered as a string — the latter avoids the sort entirely.",
      optimalTime: "O(n * k log k) with sorting, O(n * k) with counting, where k is word length",
      optimalSpace: "O(n * k)",
      bruteForce:
        "Compare every pair of words for anagram-ness and union them into groups.",
      bruteForceTime: "O(n^2 * k)",
      pitfalls: [
        "Using the sum of character codes as the key, which collides ('ad' and 'bc' both sum to 197).",
        "Building the count key as concatenated digits without a separator, so [1,11] and [11,1] collide.",
        "Mutating the input strings while sorting them in place.",
      ],
      followUps: [
        "You are sorting each word. Can you build the key without sorting, and what does that do to the complexity?",
        "What would go wrong if you used the sum of the character codes as the key?",
        "How would this change for a Unicode alphabet rather than 26 lowercase letters?",
      ],
      clarifications: [
        "Does the order of the groups matter?",
        "Are the strings all lowercase ASCII?",
        "Can the input contain empty strings?",
      ],
      hints: {
        l1: "What do two anagrams have in common that you could compute from each word independently?",
        l2: "You want a fingerprint that is identical for anagrams and different for everything else. What could you derive from the letters?",
        l3: "Sorting a word's letters gives exactly that fingerprint. Use it as the key of a hash map whose values are lists of words.",
        l4: "For each word, compute a key — sorted letters, or a 26-length count array joined with a separator — and append the word to map[key]. Return the map's values. The count key is O(k) instead of O(k log k).",
      },
    },
  },

  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "medium",
    category: "Arrays",
    description: [
      "Given an array of intervals where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals and return an array of the non-overlapping intervals that cover all the intervals in the input.",
      "Intervals that merely touch, such as `[1,4]` and `[4,5]`, are considered overlapping.",
    ],
    examples: [
      {
        input: "intervals = [[1,3],[2,6],[8,10],[15,18]]",
        output: "[[1,6],[8,10],[15,18]]",
        explanation: "[1,3] and [2,6] overlap, so they merge into [1,6].",
      },
      {
        input: "intervals = [[1,4],[4,5]]",
        output: "[[1,5]]",
        explanation: "They touch at 4, which counts as overlapping.",
      },
    ],
    constraints: [
      "1 <= intervals.length <= 10^4",
      "intervals[i].length == 2",
      "0 <= start_i <= end_i <= 10^4",
    ],
    functionName: "merge",
    paramNames: ["intervals"],
    paramTypes: ["int[][]"],
    returnType: "int[][]",
    compare: "outerUnordered",
    starter: {
      java: `class Solution {
    public int[][] merge(int[][] intervals) {
        // Write your solution here
        return new int[][]{};
    }
}`,
      python: `def merge(intervals):
    # Write your solution here
    pass`,
      javascript: `function merge(intervals) {
  // Write your solution here
}`,
    },
    tests: [
      {
        args: [[[1, 3], [2, 6], [8, 10], [15, 18]]],
        expected: [[1, 6], [8, 10], [15, 18]],
        label: "basic",
      },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]], label: "touching intervals" },
      { args: [[[1, 4]]], expected: [[1, 4]], label: "single interval" },
      {
        args: [[[1, 4], [0, 4]]],
        expected: [[0, 4]],
        hidden: true,
        label: "unsorted input",
      },
      {
        args: [[[1, 4], [2, 3]]],
        expected: [[1, 4]],
        hidden: true,
        label: "fully contained interval",
      },
      {
        args: [[[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]],
        expected: [[1, 10]],
        hidden: true,
        label: "one interval swallows the rest",
      },
      {
        args: [[[1, 1], [2, 2]]],
        expected: [[1, 1], [2, 2]],
        hidden: true,
        label: "zero-length intervals that do not touch",
      },
      {
        args: [[[5, 6], [1, 2], [3, 4]]],
        expected: [[1, 2], [3, 4], [5, 6]],
        hidden: true,
        label: "no overlap, out of order",
      },
    ],
    notes: {
      optimal:
        "Sort by start, then sweep once. Keep the last interval in the output; if the current start is <= that interval's end, extend its end to the max of the two, otherwise append.",
      optimalTime: "O(n log n), dominated by the sort",
      optimalSpace: "O(n) for the output, O(1) extra beyond the sort",
      bruteForce:
        "Repeatedly scan for any overlapping pair, merge it, and restart until no pair overlaps.",
      bruteForceTime: "O(n^3) in the worst case",
      pitfalls: [
        "Not sorting first, so a later interval that overlaps an earlier one is missed.",
        "Extending with the current interval's end rather than the max of the two ends — breaks on a fully contained interval like [[1,4],[2,3]].",
        "Treating touching intervals as non-overlapping when the problem says they merge.",
      ],
      followUps: [
        "What dominates your runtime, and could you beat it if the intervals arrived already sorted?",
        "How would you insert a single new interval into an already-merged list?",
        "How would you return the total length covered by the merged intervals?",
      ],
      clarifications: [
        "Do intervals that only touch at an endpoint count as overlapping?",
        "Is the input sorted?",
        "Does the order of the output matter?",
      ],
      hints: {
        l1: "In the unsorted input, how far away can an interval that overlaps this one be?",
        l2: "Anywhere — which is why comparing neighbours does not work yet. Is there an ordering that would make overlapping intervals adjacent?",
        l3: "Sort by start time. Then any interval that overlaps the current merged block must come immediately next.",
        l4: "Sort by start. Walk the list keeping a current interval. If next.start <= current.end, set current.end = max(current.end, next.end). Otherwise push current and make next the new current. Push the last one at the end.",
      },
    },
  },

  {
    id: "search-in-rotated-sorted-array",
    title: "Search in Rotated Sorted Array",
    difficulty: "medium",
    category: "Binary Search",
    description: [
      "An integer array `nums` sorted in ascending order with distinct values has been rotated at some unknown pivot. For example `[0,1,2,4,5,6,7]` might become `[4,5,6,7,0,1,2]`.",
      "Given the rotated array and an integer `target`, return the index of `target`, or `-1` if it is not present.",
      "You must write an algorithm with O(log n) runtime.",
    ],
    examples: [
      { input: "nums = [4,5,6,7,0,1,2], target = 0", output: "4" },
      { input: "nums = [4,5,6,7,0,1,2], target = 3", output: "-1" },
      { input: "nums = [1], target = 0", output: "-1" },
    ],
    constraints: [
      "1 <= nums.length <= 5000",
      "-10^4 <= nums[i] <= 10^4",
      "All values of nums are unique.",
      "nums is guaranteed to be a rotation of an ascending sorted array.",
    ],
    functionName: "search",
    paramNames: ["nums", "target"],
    paramTypes: ["int[]", "int"],
    returnType: "int",
    compare: "exact",
    starter: {
      java: `class Solution {
    public int search(int[] nums, int target) {
        // Write your solution here
        return -1;
    }
}`,
      python: `def search(nums, target):
    # Write your solution here
    pass`,
      javascript: `function search(nums, target) {
  // Write your solution here
}`,
    },
    tests: [
      { args: [[4, 5, 6, 7, 0, 1, 2], 0], expected: 4, label: "target after the pivot" },
      { args: [[4, 5, 6, 7, 0, 1, 2], 3], expected: -1, label: "target absent" },
      { args: [[1], 0], expected: -1, label: "single element, absent" },
      { args: [[1], 1], expected: 0, hidden: true, label: "single element, present" },
      { args: [[1, 3], 3], expected: 1, hidden: true, label: "two elements, not rotated" },
      { args: [[3, 1], 1], expected: 1, hidden: true, label: "two elements, rotated" },
      { args: [[5, 1, 3], 3], expected: 2, hidden: true, label: "three elements, rotated" },
      { args: [[1, 2, 3, 4, 5], 4], expected: 3, hidden: true, label: "not rotated at all" },
      { args: [[4, 5, 6, 7, 8, 1, 2, 3], 8], expected: 4, hidden: true, label: "target at the boundary" },
      {
        args: [[6, 7, 8, 1, 2, 3, 4, 5], 6],
        expected: 0,
        hidden: true,
        label: "target at index 0",
      },
    ],
    notes: {
      optimal:
        "Modified binary search. At each step one half is guaranteed sorted — compare nums[mid] with nums[left] to find out which. Check whether the target lies inside that sorted half and recurse into it, otherwise take the other half.",
      optimalTime: "O(log n)",
      optimalSpace: "O(1)",
      bruteForce: "Linear scan for the target.",
      bruteForceTime: "O(n)",
      pitfalls: [
        "Finding the pivot with a linear scan first, which is O(n) and defeats the requirement.",
        "Using nums[mid] > nums[left] rather than >=, which breaks on two-element windows like [3,1].",
        "Getting the boundary comparisons wrong and excluding the target when it sits exactly on an endpoint.",
      ],
      followUps: [
        "What changes if duplicates are allowed, and what does that do to the worst-case complexity?",
        "Could you instead find the rotation point first and then do a normal binary search? Compare the two approaches.",
        "How would you find the minimum element of this array?",
      ],
      clarifications: [
        "Are the values guaranteed distinct?",
        "Is the array guaranteed to actually be rotated, or could it be in plain sorted order?",
        "What should I return when the target is missing?",
      ],
      hints: {
        l1: "The array is not sorted, but it is not arbitrary either. If you cut it in half at the middle, what can you say about the two halves?",
        l2: "At least one of the two halves is always fully sorted. How would you work out which one?",
        l3: "Compare nums[mid] with nums[left]. If nums[left] <= nums[mid] the left half is sorted, otherwise the right half is. Then check whether the target falls inside the sorted half's range.",
        l4: "Binary search. If nums[left] <= nums[mid], the left half is sorted: if nums[left] <= target < nums[mid], search left, else search right. Otherwise the right half is sorted: if nums[mid] < target <= nums[right], search right, else search left. The <= on nums[left] matters for two-element windows.",
      },
    },
  },
  {
    id: "number-of-islands",
    title: "Number of Islands",
    difficulty: "medium",
    category: "Graphs",
    description: [
      "Given an `m x n` 2D grid where each cell is `'1'` (land) or `'0'` (water), return the number of islands.",
      "An island is surrounded by water and is formed by connecting adjacent land cells horizontally or vertically. Diagonal connections do not count. You may assume all four edges of the grid are surrounded by water.",
    ],
    examples: [
      {
        input: 'grid = [["1","1","0"],["1","1","0"],["0","0","1"]]',
        output: "2",
        explanation: "The 2x2 block in the corner is one island, and the single cell is another.",
      },
      {
        input: 'grid = [["1","0","1"],["0","0","0"],["1","0","1"]]',
        output: "4",
        explanation: "Diagonal cells are not connected, so each corner is its own island.",
      },
    ],
    constraints: [
      "m == grid.length, n == grid[i].length",
      "1 <= m, n <= 300",
      "grid[i][j] is '0' or '1'",
    ],
    functionName: "numIslands",
    paramNames: ["grid"],
    paramTypes: ["char[][]"],
    returnType: "int",
    compare: "exact",
    starter: {
      java: `class Solution {
    public int numIslands(char[][] grid) {
        // Write your solution here
        return 0;
    }
}`,
      python: `def numIslands(grid):
    # Write your solution here
    pass`,
      javascript: `function numIslands(grid) {
  // grid is an array of arrays of single-character strings
  // Write your solution here
}`,
    },
    tests: [
      {
        args: [[["1", "1", "0"], ["1", "1", "0"], ["0", "0", "1"]]],
        expected: 2,
        label: "two islands",
      },
      {
        args: [[["1", "0", "1"], ["0", "0", "0"], ["1", "0", "1"]]],
        expected: 4,
        label: "diagonals are not connected",
      },
      { args: [[["1"]]], expected: 1, label: "single land cell" },
      { args: [[["0"]]], expected: 0, hidden: true, label: "single water cell" },
      {
        args: [[["0", "0"], ["0", "0"]]],
        expected: 0,
        hidden: true,
        label: "all water",
      },
      {
        args: [[["1", "1", "1", "1"]]],
        expected: 1,
        hidden: true,
        label: "single row",
      },
      {
        args: [[["1"], ["0"], ["1"], ["1"]]],
        expected: 2,
        hidden: true,
        label: "single column",
      },
      {
        args: [
          [
            ["1", "1", "0", "0", "0"],
            ["1", "1", "0", "0", "0"],
            ["0", "0", "1", "0", "0"],
            ["0", "0", "0", "1", "1"],
          ],
        ],
        expected: 3,
        hidden: true,
        label: "classic three islands",
      },
      {
        args: [Array.from({ length: 60 }, () => Array.from({ length: 60 }, () => "1"))],
        expected: 1,
        hidden: true,
        label: "60x60 solid land (rejects shallow recursion limits)",
      },
    ],
    notes: {
      optimal:
        "Scan every cell. When you find unvisited land, increment the count and flood fill from it with DFS or BFS, marking every reachable land cell as visited so it is never counted again.",
      optimalTime: "O(m * n) — every cell is visited a constant number of times",
      optimalSpace: "O(m * n) worst case for the recursion stack or the queue",
      bruteForce:
        "Union-Find over every land cell, unioning each with its right and lower neighbour, then counting distinct roots.",
      bruteForceTime: "O(m * n * alpha(mn)), effectively linear but more code",
      pitfalls: [
        "Forgetting to mark cells as visited, which loops forever or double counts.",
        "Marking the cell as visited after recursing rather than before, causing infinite recursion.",
        "Checking the four neighbours without bounds checking and running off the grid.",
        "Counting diagonal neighbours as connected.",
      ],
      followUps: [
        "What is the space complexity of your recursion on a 300x300 grid of all land?",
        "How would you rewrite it iteratively to avoid a deep stack?",
        "Are you mutating the input grid? Is that acceptable, and what would you do if it were not?",
      ],
      clarifications: [
        "Are diagonal cells considered connected?",
        "Am I allowed to modify the input grid?",
        "Are the cells characters or integers?",
      ],
      hints: {
        l1: "Once you find a land cell, how do you work out how much of the grid belongs to that same island?",
        l2: "The cells of one island are all reachable from each other through up/down/left/right steps. That is a traversal problem on a graph.",
        l3: "Scan for land, and each time you find a cell you have not visited, run a DFS or BFS that marks the whole connected region, then add one to your count.",
        l4: "For every cell: if it is '1', increment the count and flood fill. The flood fill returns immediately if out of bounds or not '1'; otherwise it sets the cell to '0' (marking it visited) and recurses on the four neighbours.",
      },
    },
  },

  {
    id: "course-schedule",
    title: "Course Schedule",
    difficulty: "medium",
    category: "Graphs",
    description: [
      "There are `numCourses` courses labelled from `0` to `numCourses - 1`. You are given an array `prerequisites` where `prerequisites[i] = [a, b]` means you must take course `b` before course `a`.",
      "Return `true` if you can finish all courses, and `false` otherwise.",
    ],
    examples: [
      {
        input: "numCourses = 2, prerequisites = [[1,0]]",
        output: "true",
        explanation: "Take course 0, then course 1.",
      },
      {
        input: "numCourses = 2, prerequisites = [[1,0],[0,1]]",
        output: "false",
        explanation: "Each course requires the other, so neither can be taken first.",
      },
    ],
    constraints: [
      "1 <= numCourses <= 2000",
      "0 <= prerequisites.length <= 5000",
      "prerequisites[i].length == 2",
      "All prerequisite pairs are distinct.",
    ],
    functionName: "canFinish",
    paramNames: ["numCourses", "prerequisites"],
    paramTypes: ["int", "int[][]"],
    returnType: "boolean",
    compare: "exact",
    starter: {
      java: `class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        // Write your solution here
        return false;
    }
}`,
      python: `def canFinish(numCourses, prerequisites):
    # Write your solution here
    pass`,
      javascript: `function canFinish(numCourses, prerequisites) {
  // Write your solution here
}`,
    },
    tests: [
      { args: [2, [[1, 0]]], expected: true, label: "simple chain" },
      { args: [2, [[1, 0], [0, 1]]], expected: false, label: "two-course cycle" },
      { args: [1, []], expected: true, label: "no prerequisites" },
      {
        args: [5, [[1, 0], [2, 1], [3, 2], [4, 3]]],
        expected: true,
        hidden: true,
        label: "long chain",
      },
      {
        args: [3, [[0, 1], [1, 2], [2, 0]]],
        expected: false,
        hidden: true,
        label: "three-course cycle",
      },
      {
        args: [4, [[1, 0], [2, 0], [3, 1], [3, 2]]],
        expected: true,
        hidden: true,
        label: "diamond, no cycle",
      },
      {
        args: [6, [[1, 0], [2, 1], [4, 3], [5, 4]]],
        expected: true,
        hidden: true,
        label: "disconnected components",
      },
      {
        args: [4, [[0, 1], [1, 2], [2, 3], [3, 1]]],
        expected: false,
        hidden: true,
        label: "cycle not reachable from node 0",
      },
      {
        args: [
          2000,
          Array.from({ length: 1999 }, (_, i) => [i + 1, i]),
        ],
        expected: true,
        hidden: true,
        label: "2000-node chain (rejects exponential search)",
      },
    ],
    notes: {
      optimal:
        "Cycle detection on a directed graph. Either Kahn's algorithm — repeatedly remove nodes with in-degree zero and check that all n get removed — or DFS with three colours (unvisited / in progress / done), where meeting an in-progress node means a cycle.",
      optimalTime: "O(V + E)",
      optimalSpace: "O(V + E)",
      bruteForce:
        "Try every ordering of the courses and check whether any is valid.",
      bruteForceTime: "O(n!) — hopeless",
      pitfalls: [
        "Using a plain visited set with DFS, which cannot tell a cycle from a node already finished on another path — the diamond case reports a false cycle.",
        "Only starting the search from node 0, missing a cycle in a disconnected component.",
        "Getting the edge direction backwards, which still works for cycle detection but confuses the candidate's own explanation.",
        "Recursing 2000 deep in a language with a shallow default stack limit.",
      ],
      followUps: [
        "How would you return an actual valid ordering rather than just true or false?",
        "You used a visited set — how do you distinguish a node on the current path from one already fully explored?",
        "What is the complexity in terms of courses and prerequisites separately?",
      ],
      clarifications: [
        "Is [a,b] 'a requires b' or 'b requires a'?",
        "Can the graph be disconnected?",
        "Can there be duplicate prerequisite pairs or self-loops?",
      ],
      hints: {
        l1: "What is the one structural property of the prerequisite graph that makes finishing every course impossible?",
        l2: "A cycle. So the question is really: does this directed graph contain a cycle?",
        l3: "Two standard approaches: Kahn's algorithm peeling off nodes with in-degree zero, or a DFS that tracks which nodes are on the current recursion path.",
        l4: "Build an adjacency list and an in-degree array. Queue every course with in-degree 0. Pop one, decrement the in-degree of each neighbour, and enqueue any that reach 0. If the number of popped courses equals numCourses, return true.",
      },
    },
  },

  {
    id: "coin-change",
    title: "Coin Change",
    difficulty: "medium",
    category: "Dynamic Programming",
    description: [
      "You are given an integer array `coins` representing coin denominations, and an integer `amount`.",
      "Return the fewest number of coins needed to make up that amount. If the amount cannot be made from any combination of the coins, return `-1`.",
      "You have an infinite supply of each kind of coin.",
    ],
    examples: [
      {
        input: "coins = [1,2,5], amount = 11",
        output: "3",
        explanation: "11 = 5 + 5 + 1",
      },
      {
        input: "coins = [2], amount = 3",
        output: "-1",
        explanation: "3 cannot be made from 2s alone.",
      },
      { input: "coins = [1], amount = 0", output: "0" },
    ],
    constraints: [
      "1 <= coins.length <= 12",
      "1 <= coins[i] <= 2^31 - 1",
      "0 <= amount <= 10^4",
    ],
    functionName: "coinChange",
    paramNames: ["coins", "amount"],
    paramTypes: ["int[]", "int"],
    returnType: "int",
    compare: "exact",
    starter: {
      java: `class Solution {
    public int coinChange(int[] coins, int amount) {
        // Write your solution here
        return -1;
    }
}`,
      python: `def coinChange(coins, amount):
    # Write your solution here
    pass`,
      javascript: `function coinChange(coins, amount) {
  // Write your solution here
}`,
    },
    tests: [
      { args: [[1, 2, 5], 11], expected: 3, label: "basic" },
      { args: [[2], 3], expected: -1, label: "impossible" },
      { args: [[1], 0], expected: 0, label: "zero amount" },
      { args: [[1], 1], expected: 1, hidden: true, label: "single coin" },
      { args: [[5], 0], expected: 0, hidden: true, label: "zero amount, no usable coin" },
      { args: [[2, 5, 10, 1], 27], expected: 4, hidden: true, label: "unsorted denominations" },
      {
        args: [[186, 419, 83, 408], 6249],
        expected: 20,
        hidden: true,
        label: "greedy fails here",
      },
      { args: [[1, 3, 4], 6], expected: 2, hidden: true, label: "greedy would say 3" },
      { args: [[1, 2, 5], 100], expected: 20, hidden: true, label: "larger amount" },
      {
        args: [[1, 5, 10, 25], 9999],
        expected: 405,
        hidden: true,
        label: "10^4 amount (rejects exponential recursion)",
      },
    ],
    notes: {
      optimal:
        "Bottom-up DP over the amount. dp[x] is the fewest coins summing to x; dp[0] = 0 and dp[x] = 1 + min(dp[x - c]) over every coin c that fits.",
      optimalTime: "O(amount * number of coins)",
      optimalSpace: "O(amount)",
      bruteForce:
        "Recursively try every coin at every step, exploring the full decision tree.",
      bruteForceTime: "Exponential",
      pitfalls: [
        "Reaching for a greedy 'always take the largest coin' strategy, which fails on [1,3,4] with amount 6.",
        "Initialising the dp array with Integer.MAX_VALUE and then computing 1 + MAX_VALUE, which overflows to a negative number.",
        "Forgetting to return -1 when the amount is unreachable.",
        "Plain recursion with no memoisation, which times out at amount = 10^4.",
      ],
      followUps: [
        "Why does the greedy approach fail? Can you give me an input that breaks it?",
        "How would you also return which coins were used?",
        "What if you had to count the number of distinct combinations instead of the minimum coins?",
      ],
      clarifications: [
        "Is the coin supply unlimited?",
        "What should I return when the amount is 0?",
        "Can the amount be unreachable?",
      ],
      hints: {
        l1: "If you knew the answer for every amount smaller than the target, how would you get the answer for the target itself?",
        l2: "The last coin you place must be one of the denominations. That leaves a smaller subproblem — the same question for amount minus that coin.",
        l3: "Build an array dp where dp[x] is the fewest coins for amount x, filling it from 0 upwards.",
        l4: "dp = array of size amount+1 filled with a sentinel larger than any real answer; dp[0] = 0. For x from 1 to amount, for each coin c <= x: dp[x] = min(dp[x], dp[x-c] + 1). Return dp[amount] if it is below the sentinel, otherwise -1. Use amount+1 as the sentinel rather than MAX_VALUE to dodge overflow.",
      },
    },
  },

  {
    id: "binary-tree-level-order-traversal",
    title: "Binary Tree Level Order Traversal",
    difficulty: "medium",
    category: "Trees",
    description: [
      "Given the `root` of a binary tree, return the level order traversal of its nodes' values — that is, from left to right, level by level.",
      "In the tests below a tree is written in level order with `null` for a missing child, so `[3,9,20,null,null,15,7]` is a root of 3 with children 9 and 20, and 20 has children 15 and 7.",
    ],
    examples: [
      {
        input: "root = [3,9,20,null,null,15,7]",
        output: "[[3],[9,20],[15,7]]",
      },
      { input: "root = [1]", output: "[[1]]" },
      { input: "root = []", output: "[]" },
    ],
    constraints: [
      "The number of nodes is in the range [0, 2000].",
      "-1000 <= Node.val <= 1000",
    ],
    functionName: "levelOrder",
    paramNames: ["root"],
    paramTypes: ["TreeNode"],
    returnType: "int[][]?",
    compare: "exact",
    starter: {
      java: `/**
 * Definition for a binary tree node:
 * class TreeNode {
 *     int val;
 *     TreeNode left;
 *     TreeNode right;
 *     TreeNode() {}
 *     TreeNode(int val) { this.val = val; }
 *     TreeNode(int val, TreeNode left, TreeNode right) {
 *         this.val = val; this.left = left; this.right = right;
 *     }
 * }
 */
class Solution {
    public List<List<Integer>> levelOrder(TreeNode root) {
        // Write your solution here
        return new ArrayList<>();
    }
}`,
      python: `# Definition for a binary tree node:
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None):
#         self.val = val
#         self.left = left
#         self.right = right

def levelOrder(root):
    # Write your solution here
    pass`,
      javascript: `/**
 * Definition for a binary tree node:
 * function TreeNode(val, left, right) {
 *   this.val = (val === undefined ? 0 : val);
 *   this.left = (left === undefined ? null : left);
 *   this.right = (right === undefined ? null : right);
 * }
 */
function levelOrder(root) {
  // Write your solution here
}`,
    },
    tests: [
      {
        args: [[3, 9, 20, null, null, 15, 7]],
        expected: [[3], [9, 20], [15, 7]],
        label: "basic",
      },
      { args: [[1]], expected: [[1]], label: "single node" },
      { args: [[]], expected: [], label: "empty tree" },
      {
        args: [[1, 2, 3, 4, null, null, 5]],
        expected: [[1], [2, 3], [4, 5]],
        hidden: true,
        label: "gaps in the middle level",
      },
      {
        args: [[1, 2, null, 3, null, 4]],
        expected: [[1], [2], [3], [4]],
        hidden: true,
        label: "left-leaning chain",
      },
      {
        args: [[1, null, 2, null, 3]],
        expected: [[1], [2], [3]],
        hidden: true,
        label: "right-leaning chain",
      },
      {
        args: [[0, -1, 1]],
        expected: [[0], [-1, 1]],
        hidden: true,
        label: "negative values",
      },
    ],
    notes: {
      optimal:
        "BFS with a queue, processing one whole level per outer iteration by capturing the queue's size before the inner loop.",
      optimalTime: "O(n)",
      optimalSpace: "O(n) — the widest level can hold about n/2 nodes",
      bruteForce:
        "Compute the height, then for each depth run a separate DFS collecting nodes at exactly that depth.",
      bruteForceTime: "O(n * height), quadratic on a degenerate tree",
      pitfalls: [
        "Not snapshotting the queue size before the inner loop, so nodes from the next level leak into the current one.",
        "Returning a flat list instead of a list per level.",
        "Crashing on an empty tree instead of returning an empty list.",
        "Enqueuing null children and then dereferencing them.",
      ],
      followUps: [
        "How would you produce the levels bottom-up instead?",
        "How would you do a zigzag traversal, alternating direction each level?",
        "Could you do this with DFS? What would you have to track?",
      ],
      clarifications: [
        "Can the tree be empty?",
        "Should each level be its own list?",
        "Are the values unique?",
      ],
      hints: {
        l1: "You need to visit nodes in the order they sit in the tree, level by level. Which traversal order does that?",
        l2: "Breadth-first, using a queue. The tricky part is knowing where one level ends and the next begins.",
        l3: "At the top of each outer iteration, record how many nodes are currently in the queue — that count is exactly one level.",
        l4: "Queue the root if it exists. While the queue is non-empty: let size = queue length, then pop exactly size nodes, collect their values into one list, and push their non-null children. Append that list to the result.",
      },
    },
  },
];
