// Fill this array in with one or more new problems, then run:
//   node --env-file=.env scripts/add-problems.mjs
//
// Each entry has the same shape as the problems already in the app
// (see src/lib/problems.ts for the Problem type). Re-running with an `id`
// that already exists in Firestore overwrites that problem in place rather
// than creating a duplicate, so this file is safe to edit and re-run.

export const newProblems = [
  {
    id: "alien-dictionary",
    title: "Alien Dictionary",
    difficulty: "Hard",
    tags: "Graphs / Topological Sort",
    description:
      "You're given a list of words from an alien language, sorted lexicographically according to that language's unknown alphabet. Derive the order of characters in that alphabet. If the given order is invalid (contradictory, or a longer word appears before its own prefix), return an empty string. If multiple valid orderings exist, return the lexicographically smallest one.",
    examples: [
      { input: 'words = ["wrt","wrf","er","ett","rftt"]', output: '"wertf"' },
      { input: 'words = ["z","x"]', output: '"zx"' },
      { input: 'words = ["abc","ab"]', output: '""', explanation: '"ab" is a prefix of "abc" but appears after it, which is invalid.' },
    ],
    constraints: [
      "1 <= words.length <= 100",
      "1 <= words[i].length <= 20",
      "words[i] consists of lowercase English letters.",
    ],
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
      { args: [["abc", "ab"]], expected: "" },
    ],
  },
  {
    id: "course-schedule-ii",
    title: "Course Schedule II",
    difficulty: "Medium",
    tags: "Graphs / Topological Sort",
    description:
      "There are numCourses courses labeled 0 to numCourses - 1. You're given prerequisites where prerequisites[i] = [a, b] means you must take course b before course a. Return a valid order in which to take all the courses, or an empty array if it's impossible.",
    examples: [
      { input: "numCourses = 2, prerequisites = [[1,0]]", output: "[0,1]" },
      { input: "numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]", output: "[0,1,2,3]" },
    ],
    constraints: [
      "1 <= numCourses <= 2000",
      "0 <= prerequisites.length <= 5000",
      "prerequisites[i].length == 2",
    ],
    funcName: "course_order",
    paramTypes: ["int", "int[][]"],
    returnType: "int[]",
    starterCode: {
      python: `def course_order(numCourses, prerequisites):
    # your code here
    pass
`,
      javascript: `function course_order(numCourses, prerequisites) {
  // your code here
}
`,
      cpp: `vector<int> course_order(int numCourses, vector<vector<int>>& prerequisites) {
    // your code here
    return {};
}
`,
      c: `int* course_order(int numCourses, int** prerequisites, int prerequisitesSize, int* prerequisitesColSize,
                   int* returnSize) {
    // your code here
    *returnSize = 0;
    return NULL;
}
`,
      java: `class Solution {
    public int[] course_order(int numCourses, int[][] prerequisites) {
        // your code here
        return new int[0];
    }
}
`,
      csharp: `public class Solution {
    public int[] course_order(int numCourses, int[][] prerequisites) {
        // your code here
        return new int[0];
    }
}
`,
    },
    testCases: [
      { args: [2, [[1, 0]]], expected: [0, 1] },
      { args: [4, [[1, 0], [2, 0], [3, 1], [3, 2]]], expected: [0, 1, 2, 3] },
      { args: [2, [[1, 0], [0, 1]]], expected: [] },
      { args: [1, []], expected: [0] },
    ],
  },
  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    tags: "Strings / Hash Map",
    description:
      "Given an array of strings strs, group the anagrams together. Return the groups sorted by their sorted-character key (so \"eat\" and \"tea\" both sort under key \"aet\"), and within each group, keep the strings in the order they first appeared in strs.",
    examples: [
      {
        input: 'strs = ["eat","tea","tan","ate","nat","bat"]',
        output: '[["bat"],["eat","tea","ate"],["tan","nat"]]',
      },
      { input: 'strs = [""]', output: '[[""]]' },
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
        expected: [["bat"], ["eat", "tea", "ate"], ["tan", "nat"]],
      },
      { args: [[""]], expected: [[""]] },
      { args: [["a"]], expected: [["a"]] },
    ],
  },
  {
    id: "count-unique-chars-substrings",
    title: "Sum of Distinct Characters Over All Substrings",
    difficulty: "Hard",
    tags: "Strings / Math",
    description:
      "Given a string s, consider every contiguous substring of s. For each substring, count how many distinct characters it contains, then return the sum of that count across every substring.",
    examples: [
      { input: 's = "ABC"', output: "10" },
      { input: 's = "ABA"', output: "9" },
    ],
    constraints: ["1 <= s.length <= 10^4", "s consists of uppercase English letters."],
    funcName: "count_unique_chars_substrings",
    paramTypes: ["string"],
    returnType: "int",
    starterCode: {
      python: `def count_unique_chars_substrings(s):
    # your code here
    pass
`,
      javascript: `function count_unique_chars_substrings(s) {
  // your code here
}
`,
      cpp: `int count_unique_chars_substrings(string s) {
    // your code here
    return 0;
}
`,
      c: `int count_unique_chars_substrings(char* s) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int count_unique_chars_substrings(String s) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int count_unique_chars_substrings(string s) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: ["ABC"], expected: 10 },
      { args: ["ABA"], expected: 9 },
      { args: ["AAAA"], expected: 10 },
      { args: ["Z"], expected: 1 },
    ],
  },
  {
    id: "word-ladder",
    title: "Word Ladder",
    difficulty: "Hard",
    tags: "Graphs / BFS",
    description:
      "Given a beginWord, an endWord, and a wordList, return the number of words in the shortest transformation sequence from beginWord to endWord, where each step changes exactly one letter and every intermediate word must exist in wordList. Return 0 if no such sequence exists.",
    examples: [
      {
        input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]',
        output: "5",
        explanation: '"hit" -> "hot" -> "dot" -> "dog" -> "cog"',
      },
      {
        input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log"]',
        output: "0",
      },
    ],
    constraints: [
      "1 <= beginWord.length <= 10",
      "endWord.length == beginWord.length",
      "1 <= wordList.length <= 5000",
      "All words consist of lowercase English letters and are the same length.",
    ],
    funcName: "word_ladder_length",
    starterCode: {
      python: `def word_ladder_length(beginWord, endWord, wordList):
    # your code here
    pass
`,
      javascript: `function word_ladder_length(beginWord, endWord, wordList) {
  // your code here
}
`,
    },
    testCases: [
      { args: ["hit", "cog", ["hot", "dot", "dog", "lot", "log", "cog"]], expected: 5 },
      { args: ["hit", "cog", ["hot", "dot", "dog", "lot", "log"]], expected: 0 },
      { args: ["hot", "dog", ["hot", "dog", "dot"]], expected: 3 },
    ],
  },
  {
    id: "shortest-path-two-portals",
    title: "Shortest Path Between Two Portals",
    difficulty: "Medium",
    tags: "BFS/DFS / Matrix",
    description:
      "You're given a grid of integers where 0 is an open path, 1 is a wall, and 2 marks a portal. The grid has exactly two portal cells. Return the length of the shortest path (in steps) between the two portals, moving up/down/left/right through open cells, or -1 if no path connects them.",
    examples: [
      {
        input: "grid = [[2,0,0,0],[1,1,0,1],[0,0,0,0],[0,1,1,2]]",
        output: "6",
      },
      { input: "grid = [[2,1],[0,2]]", output: "2" },
    ],
    constraints: [
      "1 <= grid.length, grid[0].length <= 100",
      "grid[i][j] is 0, 1, or 2.",
      "Exactly two cells equal 2.",
    ],
    funcName: "shortest_path_between_portals",
    paramTypes: ["int[][]"],
    returnType: "int",
    starterCode: {
      python: `def shortest_path_between_portals(grid):
    # your code here
    pass
`,
      javascript: `function shortest_path_between_portals(grid) {
  // your code here
}
`,
      cpp: `int shortest_path_between_portals(vector<vector<int>>& grid) {
    // your code here
    return -1;
}
`,
      c: `int shortest_path_between_portals(int** grid, int gridSize, int* gridColSize) {
    // your code here
    return -1;
}
`,
      java: `class Solution {
    public int shortest_path_between_portals(int[][] grid) {
        // your code here
        return -1;
    }
}
`,
      csharp: `public class Solution {
    public int shortest_path_between_portals(int[][] grid) {
        // your code here
        return -1;
    }
}
`,
    },
    testCases: [
      { args: [[[2, 0, 0, 0], [1, 1, 0, 1], [0, 0, 0, 0], [0, 1, 1, 2]]], expected: 6 },
      { args: [[[2, 1], [0, 2]]], expected: 2 },
      { args: [[[2, 1, 2]]], expected: -1 },
    ],
  },
  {
    id: "traveling-salesman",
    title: "Minimum Tour Cost",
    difficulty: "Hard",
    tags: "Dynamic Programming / Graphs",
    description:
      "You're given a square matrix dist where dist[i][j] is the travel cost from city i to city j. Starting and ending at city 0, find the minimum total cost of a tour that visits every other city exactly once.",
    examples: [
      {
        input: "dist = [[0,10,15,20],[10,0,35,25],[15,35,0,30],[20,25,30,0]]",
        output: "80",
      },
      { input: "dist = [[0,5],[5,0]]", output: "10" },
    ],
    constraints: ["2 <= dist.length <= 12", "dist[i][i] == 0", "0 <= dist[i][j] <= 1000"],
    funcName: "min_tour_cost",
    paramTypes: ["int[][]"],
    returnType: "int",
    starterCode: {
      python: `def min_tour_cost(dist):
    # your code here
    pass
`,
      javascript: `function min_tour_cost(dist) {
  // your code here
}
`,
      cpp: `int min_tour_cost(vector<vector<int>>& dist) {
    // your code here
    return 0;
}
`,
      c: `int min_tour_cost(int** dist, int distSize, int* distColSize) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int min_tour_cost(int[][] dist) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int min_tour_cost(int[][] dist) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: [[[0, 10, 15, 20], [10, 0, 35, 25], [15, 35, 0, 30], [20, 25, 30, 0]]], expected: 80 },
      { args: [[[0, 5], [5, 0]]], expected: 10 },
      { args: [[[0, 2, 9, 10], [1, 0, 6, 4], [15, 7, 0, 8], [6, 3, 12, 0]]], expected: 21 },
    ],
  },
  {
    id: "remove-duplicates-sorted-array",
    title: "Remove Duplicates from Sorted Array",
    difficulty: "Easy",
    tags: "Arrays / Two Pointers",
    description:
      "Given an integer array nums sorted in non-decreasing order, return a new array with each distinct value appearing only once, preserving order.",
    examples: [
      { input: "nums = [1,1,2,2,3]", output: "[1,2,3]" },
      { input: "nums = [1,1,1,2,3,3]", output: "[1,2,3]" },
    ],
    constraints: ["0 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9", "nums is sorted in non-decreasing order."],
    funcName: "remove_duplicates",
    paramTypes: ["int[]"],
    returnType: "int[]",
    starterCode: {
      python: `def remove_duplicates(nums):
    # your code here
    pass
`,
      javascript: `function remove_duplicates(nums) {
  // your code here
}
`,
      cpp: `vector<int> remove_duplicates(vector<int>& nums) {
    // your code here
    return {};
}
`,
      c: `int* remove_duplicates(int* nums, int numsSize, int* returnSize) {
    // your code here
    *returnSize = 0;
    return NULL;
}
`,
      java: `class Solution {
    public int[] remove_duplicates(int[] nums) {
        // your code here
        return new int[0];
    }
}
`,
      csharp: `public class Solution {
    public int[] remove_duplicates(int[] nums) {
        // your code here
        return new int[0];
    }
}
`,
    },
    testCases: [
      { args: [[1, 1, 2, 2, 3]], expected: [1, 2, 3] },
      { args: [[1, 1, 1, 2, 3, 3]], expected: [1, 2, 3] },
      { args: [[]], expected: [] },
      { args: [[-3, -3, -1, 0, 0, 0, 2]], expected: [-3, -1, 0, 2] },
    ],
  },
  {
    id: "add-two-numbers",
    title: "Add Two Numbers",
    difficulty: "Medium",
    tags: "Arrays / Math",
    description:
      "You're given two non-negative integers represented as arrays of digits in reverse order (the 1's digit first). Add the two numbers and return the sum in the same reverse-digit-array format.",
    examples: [
      { input: "a = [2,4,3], b = [5,6,4]", output: "[7,0,8]", explanation: "342 + 465 = 807." },
      { input: "a = [9,9], b = [1]", output: "[0,0,1]", explanation: "99 + 1 = 100." },
    ],
    constraints: [
      "1 <= a.length, b.length <= 100",
      "0 <= a[i], b[i] <= 9",
      "Neither array has a leading zero digit, except a single [0].",
    ],
    funcName: "add_two_numbers",
    paramTypes: ["int[]", "int[]"],
    returnType: "int[]",
    starterCode: {
      python: `def add_two_numbers(a, b):
    # your code here
    pass
`,
      javascript: `function add_two_numbers(a, b) {
  // your code here
}
`,
      cpp: `vector<int> add_two_numbers(vector<int>& a, vector<int>& b) {
    // your code here
    return {};
}
`,
      c: `int* add_two_numbers(int* a, int aSize, int* b, int bSize, int* returnSize) {
    // your code here
    *returnSize = 0;
    return NULL;
}
`,
      java: `class Solution {
    public int[] add_two_numbers(int[] a, int[] b) {
        // your code here
        return new int[0];
    }
}
`,
      csharp: `public class Solution {
    public int[] add_two_numbers(int[] a, int[] b) {
        // your code here
        return new int[0];
    }
}
`,
    },
    testCases: [
      { args: [[2, 4, 3], [5, 6, 4]], expected: [7, 0, 8] },
      { args: [[9, 9], [1]], expected: [0, 0, 1] },
      { args: [[0], [0]], expected: [0] },
      { args: [[1, 8], [0]], expected: [1, 8] },
    ],
  },
  {
    id: "best-reading-day",
    title: "Best Reading Day",
    difficulty: "Medium",
    tags: "Arrays",
    description:
      "You're given pages, where pages[i] is the number of pages in chapter i of a book (an even number of chapters). Each day you read one chapter from the front and one from the back, in order, until the book is finished. Return the index of the day (0-indexed) on which you read the most total pages. If there's a tie, return the earliest such day.",
    examples: [
      { input: "pages = [10,20,5,5,30,15]", output: "1", explanation: "Day 1 reads chapters 20 and 30, totalling 50 - the most of any day." },
      { input: "pages = [1,2,3,4]", output: "0" },
    ],
    constraints: ["2 <= pages.length <= 10^4", "pages.length is even.", "1 <= pages[i] <= 10^4"],
    funcName: "best_reading_day",
    paramTypes: ["int[]"],
    returnType: "int",
    starterCode: {
      python: `def best_reading_day(pages):
    # your code here
    pass
`,
      javascript: `function best_reading_day(pages) {
  // your code here
}
`,
      cpp: `int best_reading_day(vector<int>& pages) {
    // your code here
    return 0;
}
`,
      c: `int best_reading_day(int* pages, int pagesSize) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int best_reading_day(int[] pages) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int best_reading_day(int[] pages) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: [[10, 20, 5, 5, 30, 15]], expected: 1 },
      { args: [[1, 2, 3, 4]], expected: 0 },
      { args: [[5, 5, 5, 5, 5, 5]], expected: 0 },
    ],
  },
  {
    id: "concatenated-words",
    title: "Concatenated Words",
    difficulty: "Hard",
    tags: "Strings / Dynamic Programming",
    description:
      "Given an array of unique words, return every word that can be built entirely by concatenating at least two shorter words from the same array. Return the result sorted alphabetically.",
    examples: [
      {
        input:
          'words = ["cat","cats","catsdogcats","dog","dogcatsdog","hippopotamuses","rat","ratcatdogcat"]',
        output: '["catsdogcats","dogcatsdog","ratcatdogcat"]',
      },
      { input: 'words = ["a","b","ab"]', output: '["ab"]' },
    ],
    constraints: [
      "1 <= words.length <= 10^4",
      "0 <= words[i].length <= 30",
      "words consists of unique lowercase English words.",
    ],
    funcName: "concatenated_words",
    starterCode: {
      python: `def concatenated_words(words):
    # your code here
    pass
`,
      javascript: `function concatenated_words(words) {
  // your code here
}
`,
    },
    testCases: [
      {
        args: [
          ["cat", "cats", "catsdogcats", "dog", "dogcatsdog", "hippopotamuses", "rat", "ratcatdogcat"],
        ],
        expected: ["catsdogcats", "dogcatsdog", "ratcatdogcat"],
      },
      { args: [["a", "b", "ab"]], expected: ["ab"] },
      { args: [["cat", "dog", "catdog"]], expected: ["catdog"] },
    ],
  },
  {
    id: "josephus-survivor",
    title: "Josephus Survivor",
    difficulty: "Medium",
    tags: "Arrays / Simulation",
    description:
      "entities holds n values arranged in a circle. Starting at the front and counting around the circle, every kth remaining entity is eliminated. Continue until only one entity remains, and return its value.",
    examples: [
      { input: "entities = [1,2,3,4,5,6,7], k = 3", output: "4" },
      { input: "entities = [10,20,30,40], k = 1", output: "40" },
    ],
    constraints: ["1 <= entities.length <= 10^4", "1 <= k <= 500"],
    funcName: "josephus_survivor",
    paramTypes: ["int[]", "int"],
    returnType: "int",
    starterCode: {
      python: `def josephus_survivor(entities, k):
    # your code here
    pass
`,
      javascript: `function josephus_survivor(entities, k) {
  // your code here
}
`,
      cpp: `int josephus_survivor(vector<int>& entities, int k) {
    // your code here
    return 0;
}
`,
      c: `int josephus_survivor(int* entities, int entitiesSize, int k) {
    // your code here
    return 0;
}
`,
      java: `class Solution {
    public int josephus_survivor(int[] entities, int k) {
        // your code here
        return 0;
    }
}
`,
      csharp: `public class Solution {
    public int josephus_survivor(int[] entities, int k) {
        // your code here
        return 0;
    }
}
`,
    },
    testCases: [
      { args: [[1, 2, 3, 4, 5, 6, 7], 3], expected: 4 },
      { args: [[1], 5], expected: 1 },
      { args: [[10, 20, 30, 40], 1], expected: 40 },
    ],
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    tags: "Arrays / Binary Search",
    description:
      "Given a sorted array of integers nums and a target value, return the index of target in nums, or -1 if it isn't present.",
    examples: [
      { input: "nums = [1,3,5,7,9,11], target = 7", output: "3" },
      { input: "nums = [1,3,5,7,9,11], target = 4", output: "-1" },
    ],
    constraints: ["0 <= nums.length <= 10^5", "nums is sorted in ascending order with no duplicates."],
    funcName: "binary_search",
    paramTypes: ["int[]", "int"],
    returnType: "int",
    starterCode: {
      python: `def binary_search(nums, target):
    # your code here
    pass
`,
      javascript: `function binary_search(nums, target) {
  // your code here
}
`,
      cpp: `int binary_search(vector<int>& nums, int target) {
    // your code here
    return -1;
}
`,
      c: `int binary_search(int* nums, int numsSize, int target) {
    // your code here
    return -1;
}
`,
      java: `class Solution {
    public int binary_search(int[] nums, int target) {
        // your code here
        return -1;
    }
}
`,
      csharp: `public class Solution {
    public int binary_search(int[] nums, int target) {
        // your code here
        return -1;
    }
}
`,
    },
    testCases: [
      { args: [[1, 3, 5, 7, 9, 11], 7], expected: 3 },
      { args: [[1, 3, 5, 7, 9, 11], 4], expected: -1 },
      { args: [[], 1], expected: -1 },
      { args: [[2], 2], expected: 0 },
    ],
  },
];
