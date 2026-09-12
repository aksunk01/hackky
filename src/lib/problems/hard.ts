import type { Problem } from "@/lib/types";

export const HARD_PROBLEMS: Problem[] = [
  {
    id: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "hard",
    category: "Two Pointers",
    description: [
      "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
      "Water sits on top of a bar up to the level of the lower of the tallest bars on its left and on its right.",
    ],
    examples: [
      {
        input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]",
        output: "6",
        explanation: "The dips between the taller bars hold 6 units of water in total.",
      },
      {
        input: "height = [4,2,0,3,2,5]",
        output: "9",
      },
    ],
    constraints: [
      "n == height.length",
      "1 <= n <= 2 * 10^4",
      "0 <= height[i] <= 10^5",
    ],
    functionName: "trap",
    paramNames: ["height"],
    paramTypes: ["int[]"],
    returnType: "int",
    compare: "exact",
    starter: {
      java: `class Solution {
    public int trap(int[] height) {
        // Write your solution here
        return 0;
    }
}`,
      python: `def trap(height):
    # Write your solution here
    pass`,
      javascript: `function trap(height) {
  // Write your solution here
}`,
    },
    tests: [
      { args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], expected: 6, label: "classic" },
      { args: [[4, 2, 0, 3, 2, 5]], expected: 9, label: "deep basin" },
      { args: [[3, 0, 3]], expected: 3, label: "single dip" },
      { args: [[1]], expected: 0, hidden: true, label: "single bar" },
      { args: [[5, 4, 3, 2, 1]], expected: 0, hidden: true, label: "monotonically falling" },
      { args: [[1, 2, 3, 4, 5]], expected: 0, hidden: true, label: "monotonically rising" },
      { args: [[0, 0, 0]], expected: 0, hidden: true, label: "flat ground" },
      { args: [[2, 0, 2]], expected: 2, hidden: true, label: "symmetric basin" },
      { args: [[4, 2, 3]], expected: 1, hidden: true, label: "right wall is the shorter one" },
      {
        args: [Array.from({ length: 20000 }, (_, i) => (i % 2 === 0 ? 0 : 100))],
        expected: 999900,
        hidden: true,
        label: "20k alternating bars (rejects O(n^2))",
      },
    ],
    notes: {
      optimal:
        "Two pointers from both ends, tracking the tallest bar seen from each side. Always advance the pointer on the side whose running maximum is smaller — that side's maximum is guaranteed to be the limiting wall, so the water above that bar is known immediately.",
      optimalTime: "O(n)",
      optimalSpace: "O(1)",
      bruteForce:
        "For each bar, scan left and right for the tallest bar on each side; the water above it is min(leftMax, rightMax) - height[i].",
      bruteForceTime: "O(n^2), or O(n) time with O(n) space using two precomputed max arrays",
      pitfalls: [
        "Adding a negative contribution when the bar is taller than one of the running maxima — always clamp at zero, or update the max before subtracting.",
        "Advancing the wrong pointer, which uses a wall that is not actually the limiting one.",
        "Attempting a single global maximum split without handling the two halves separately.",
      ],
      followUps: [
        "You started with the precomputed prefix/suffix maximum arrays. Can you get it to O(1) space?",
        "Why is it safe to advance the pointer on the smaller side? Convince me.",
        "How would this change in two dimensions, with a grid of heights?",
      ],
      clarifications: [
        "Can the array be empty or have a single element?",
        "Are the heights guaranteed non-negative?",
        "Does each bar have width 1?",
      ],
      hints: {
        l1: "Pick one bar in the middle. What determines how much water sits on top of that specific bar?",
        l2: "It is min(tallest to the left, tallest to the right) minus its own height. So the question becomes how to know both maxima cheaply for every bar.",
        l3: "You could precompute prefix and suffix maximum arrays for O(n) time and O(n) space. To reach O(1) space, walk two pointers inwards while tracking a running max on each side.",
        l4: "left = 0, right = n-1, leftMax = rightMax = 0, total = 0. While left < right: if height[left] < height[right], then update leftMax = max(leftMax, height[left]), add leftMax - height[left] to total, and left++. Otherwise do the mirror on the right. Because you always move the smaller side, the side you are on is the limiting wall.",
      },
    },
  },

  {
    id: "minimum-window-substring",
    title: "Minimum Window Substring",
    difficulty: "hard",
    category: "Sliding Window",
    description: [
      "Given two strings `s` and `t`, return the shortest substring of `s` that contains every character of `t`, including duplicates.",
      "If no such substring exists, return the empty string `\"\"`. The test cases guarantee the answer is unique.",
    ],
    examples: [
      {
        input: 's = "ADOBECODEBANC", t = "ABC"',
        output: '"BANC"',
        explanation: 'The window "BANC" contains A, B and C and is the shortest that does.',
      },
      { input: 's = "a", t = "a"', output: '"a"' },
      {
        input: 's = "a", t = "aa"',
        output: '""',
        explanation: 's has only one "a", so no window contains both copies.',
      },
    ],
    constraints: [
      "1 <= s.length, t.length <= 10^5",
      "s and t consist of uppercase and lowercase English letters.",
    ],
    functionName: "minWindow",
    paramNames: ["s", "t"],
    paramTypes: ["string", "string"],
    returnType: "string",
    compare: "exact",
    starter: {
      java: `class Solution {
    public String minWindow(String s, String t) {
        // Write your solution here
        return "";
    }
}`,
      python: `def minWindow(s, t):
    # Write your solution here
    pass`,
      javascript: `function minWindow(s, t) {
  // Write your solution here
}`,
    },
    tests: [
      { args: ["ADOBECODEBANC", "ABC"], expected: "BANC", label: "classic" },
      { args: ["a", "a"], expected: "a", label: "single character" },
      { args: ["a", "aa"], expected: "", label: "duplicates in t make it impossible" },
      { args: ["ab", "b"], expected: "b", hidden: true, label: "answer at the end" },
      { args: ["bba", "ab"], expected: "ba", hidden: true, label: "answer is a suffix" },
      {
        args: ["cabwefgewcwaefgcf", "cae"],
        expected: "cwae",
        hidden: true,
        label: "long string, mid answer",
      },
      { args: ["aa", "aa"], expected: "aa", hidden: true, label: "t equals s" },
      { args: ["abc", "d"], expected: "", hidden: true, label: "character not present" },
      { args: ["aaflslflsflslflsflsflsflsflsf", "aal"], expected: "aafl", hidden: true, label: "duplicate requirement" },
      {
        args: ["x".repeat(50000) + "y", "y"],
        expected: "y",
        hidden: true,
        label: "50k characters (rejects O(n^2))",
      },
    ],
    notes: {
      optimal:
        "Sliding window with a need-count map for t and a 'how many distinct characters are currently satisfied' counter. Expand the right edge until the window is valid, then contract the left edge as far as it stays valid, recording the best window each time.",
      optimalTime: "O(|s| + |t|)",
      optimalSpace: "O(|s| + |t|)",
      bruteForce:
        "Check every substring of s for whether it covers t.",
      bruteForceTime: "O(n^2 * |t|)",
      pitfalls: [
        "Using a set instead of counts, so duplicate requirements like t = 'aa' are satisfied by a single 'a'.",
        "Tracking 'characters matched' instead of 'distinct characters fully satisfied', which makes the validity check wrong when the window over-collects one character.",
        "Recording the best window before shrinking, so a shorter valid window is missed.",
        "Returning a length instead of the substring itself.",
      ],
      followUps: [
        "What is your complexity, and why is it linear even though the left pointer is inside a loop?",
        "How would you handle a Unicode alphabet rather than 52 ASCII letters?",
        "What changes if the characters of t may appear in any order but must be contiguous in s?",
      ],
      clarifications: [
        "Do duplicate characters in t have to appear that many times in the window?",
        "Does the order of t's characters matter inside the window?",
        "What should I return when no window exists?",
      ],
      hints: {
        l1: "You are looking for the shortest contiguous window with a property. What family of techniques does that suggest?",
        l2: "A sliding window. The hard part is answering 'is this window valid' in O(1) rather than rescanning it.",
        l3: "Keep a map of required counts from t, and a counter of how many distinct characters currently meet their required count. The window is valid when that counter equals the number of distinct characters in t.",
        l4: "Build need[] from t and set required = number of distinct characters in t. Expand right, decrementing need for each character and incrementing formed when a character's count hits exactly its requirement. While formed == required, record the window if it beats the best, then advance left, undoing the counts and decrementing formed if that character drops below its requirement.",
      },
    },
  },
];
