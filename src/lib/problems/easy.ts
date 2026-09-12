import type { Problem } from "@/lib/types";

export const EASY_PROBLEMS: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    category: "Hash Maps",
    description: [
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`.",
      "You may assume that each input has exactly one solution, and you may not use the same element twice.",
      "You can return the answer in any order.",
    ],
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "nums[0] + nums[1] == 9, so we return [0, 1].",
      },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
      { input: "nums = [3,3], target = 6", output: "[0,1]" },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Exactly one valid answer exists.",
    ],
    functionName: "twoSum",
    paramNames: ["nums", "target"],
    paramTypes: ["int[]", "int"],
    returnType: "int[]",
    compare: "sortedArray",
    starter: {
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        // Write your solution here
        return new int[]{};
    }
}`,
      python: `def twoSum(nums, target):
    # Write your solution here
    pass`,
      javascript: `function twoSum(nums, target) {
  // Write your solution here
}`,
    },
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1], label: "basic" },
      { args: [[3, 2, 4], 6], expected: [1, 2], label: "answer not at index 0" },
      { args: [[3, 3], 6], expected: [0, 1], label: "duplicate values" },
      {
        args: [[-1, -2, -3, -4, -5], -8],
        expected: [2, 4],
        hidden: true,
        label: "negative numbers",
      },
      {
        args: [[0, 4, 3, 0], 0],
        expected: [0, 3],
        hidden: true,
        label: "two zeroes",
      },
      {
        args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 19],
        expected: [8, 9],
        hidden: true,
        label: "answer at the end",
      },
      {
        args: [Array.from({ length: 8000 }, (_, i) => i), 15997],
        expected: [7998, 7999],
        hidden: true,
        label: "large input (rejects O(n^2))",
      },
    ],
    notes: {
      optimal:
        "One pass with a hash map from value -> index. For each number, look up target - num; if it is already in the map you have the answer, otherwise store the current number.",
      optimalTime: "O(n)",
      optimalSpace: "O(n)",
      bruteForce:
        "Nested loops testing every pair of indices until one sums to target.",
      bruteForceTime: "O(n^2)",
      pitfalls: [
        "Storing every number in the map up front, which lets an element pair with itself.",
        "Returning the values instead of the indices.",
        "Assuming the array is sorted and reaching for two pointers without sorting (which destroys the original indices).",
      ],
      followUps: [
        "What happens to your solution if the array were already sorted?",
        "How would you change it if you had to return every pair that sums to the target?",
        "Your map stores n entries. Is there any way to do this in constant extra space, and what would you give up?",
      ],
      clarifications: [
        "Can the same element be used twice?",
        "Are there duplicate values in the array?",
        "Is exactly one answer guaranteed, or could there be none?",
        "Can the numbers be negative?",
      ],
      hints: {
        l1: "What is the expensive operation in your brute-force approach?",
        l2: "For each number, you are searching the rest of the array for one specific value. Is there a data structure that makes that search cheap?",
        l3: "A hash map gives you average O(1) lookup. What would you want to store in it, and what would you look up?",
        l4: "Walk the array once. For each number, check whether target - num is already a key in your map. If it is, return that stored index and the current one. If not, add num -> current index and keep going.",
      },
    },
  },

  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "easy",
    category: "Stacks / Queues",
    description: [
      "Given a string `s` containing only the characters `(`, `)`, `{`, `}`, `[` and `]`, determine whether the input string is valid.",
      "A string is valid when open brackets are closed by the same type of bracket, open brackets are closed in the correct order, and every closing bracket has a matching opening bracket of the same type.",
    ],
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "()[]{}"', output: "true" },
      {
        input: 's = "(]"',
        output: "false",
        explanation: "The closing bracket does not match the most recent opening bracket.",
      },
    ],
    constraints: [
      "1 <= s.length <= 10^4",
      "s consists only of the characters '()[]{}'",
    ],
    functionName: "isValid",
    paramNames: ["s"],
    paramTypes: ["string"],
    returnType: "boolean",
    compare: "exact",
    starter: {
      java: `class Solution {
    public boolean isValid(String s) {
        // Write your solution here
        return false;
    }
}`,
      python: `def isValid(s):
    # Write your solution here
    pass`,
      javascript: `function isValid(s) {
  // Write your solution here
}`,
    },
    tests: [
      { args: ["()"], expected: true, label: "simple pair" },
      { args: ["()[]{}"], expected: true, label: "sequential pairs" },
      { args: ["(]"], expected: false, label: "mismatched types" },
      { args: ["([)]"], expected: false, hidden: true, label: "interleaved" },
      { args: ["{[]}"], expected: true, hidden: true, label: "nested" },
      { args: ["("], expected: false, hidden: true, label: "unclosed opener" },
      { args: [")"], expected: false, hidden: true, label: "closer with empty stack" },
      { args: ["]"], expected: false, hidden: true, label: "lone closer" },
      {
        args: ["(".repeat(2000) + ")".repeat(2000)],
        expected: true,
        hidden: true,
        label: "deeply nested",
      },
      { args: ["(){}}{"], expected: false, hidden: true, label: "trailing garbage" },
    ],
    notes: {
      optimal:
        "Push opening brackets onto a stack. On a closing bracket, pop and check the popped opener matches. The string is valid when every closer matched and the stack ends empty.",
      optimalTime: "O(n)",
      optimalSpace: "O(n)",
      bruteForce:
        "Repeatedly find and delete adjacent matching pairs until the string stops shrinking, then check whether it is empty.",
      bruteForceTime: "O(n^2)",
      pitfalls: [
        "Forgetting to check that the stack is empty at the end, so '(((' is reported valid.",
        "Popping an empty stack when the string starts with a closing bracket.",
        "Counting brackets instead of tracking order, so '([)]' is reported valid.",
      ],
      followUps: [
        "What does your solution return for a string of 10,000 open brackets, and why?",
        "How would you extend this to also handle plain text between the brackets?",
        "Could you do this without an explicit stack if there were only one bracket type?",
      ],
      clarifications: [
        "Can the string be empty?",
        "Are there characters other than brackets in the input?",
        "Should an unclosed opening bracket be treated as invalid?",
      ],
      hints: {
        l1: "When you see a closing bracket, which opening bracket does it have to match?",
        l2: "The bracket a closer must match is always the most recently opened one that is still unclosed. What ordering does that describe?",
        l3: "That is last-in-first-out, which is exactly a stack. Push openers, and on a closer compare against the top.",
        l4: "Push every opening bracket. On a closing bracket, return false if the stack is empty or the top is not its partner, otherwise pop. At the end return whether the stack is empty.",
      },
    },
  },

  {
    id: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "easy",
    category: "Arrays",
    description: [
      "You are given an array `prices` where `prices[i]` is the price of a given stock on day `i`.",
      "You want to maximise your profit by choosing a single day to buy one stock and choosing a different day in the future to sell it.",
      "Return the maximum profit you can achieve. If no profit is possible, return `0`.",
    ],
    examples: [
      {
        input: "prices = [7,1,5,3,6,4]",
        output: "5",
        explanation: "Buy on day 2 (price = 1) and sell on day 5 (price = 6).",
      },
      {
        input: "prices = [7,6,4,3,1]",
        output: "0",
        explanation: "Prices only fall, so no profitable transaction exists.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    functionName: "maxProfit",
    paramNames: ["prices"],
    paramTypes: ["int[]"],
    returnType: "int",
    compare: "exact",
    starter: {
      java: `class Solution {
    public int maxProfit(int[] prices) {
        // Write your solution here
        return 0;
    }
}`,
      python: `def maxProfit(prices):
    # Write your solution here
    pass`,
      javascript: `function maxProfit(prices) {
  // Write your solution here
}`,
    },
    tests: [
      { args: [[7, 1, 5, 3, 6, 4]], expected: 5, label: "basic" },
      { args: [[7, 6, 4, 3, 1]], expected: 0, label: "monotonically falling" },
      { args: [[1, 2]], expected: 1, label: "two days" },
      { args: [[1]], expected: 0, hidden: true, label: "single day" },
      { args: [[3, 3, 3]], expected: 0, hidden: true, label: "flat prices" },
      { args: [[2, 4, 1]], expected: 2, hidden: true, label: "best pair is not the global min/max" },
      { args: [[2, 1, 2, 1, 0, 1, 2]], expected: 2, hidden: true, label: "min after an earlier peak" },
      {
        args: [Array.from({ length: 50000 }, (_, i) => 50000 - i)],
        expected: 0,
        hidden: true,
        label: "large falling input (rejects O(n^2))",
      },
    ],
    notes: {
      optimal:
        "One pass tracking the minimum price seen so far and the best profit achievable if you sold today.",
      optimalTime: "O(n)",
      optimalSpace: "O(1)",
      bruteForce: "Check every buy/sell pair with nested loops.",
      bruteForceTime: "O(n^2)",
      pitfalls: [
        "Selling before buying — subtracting a later minimum from an earlier maximum.",
        "Returning a negative number instead of 0 when prices only fall.",
        "Taking global max minus global min without checking the order of the two days.",
      ],
      followUps: [
        "What if you were allowed as many transactions as you like?",
        "What if you had to hold the stock for at least two days before selling?",
        "Can you tell me the space complexity of what you wrote, and why it is what it is?",
      ],
      clarifications: [
        "Must the sell day come strictly after the buy day?",
        "Can I do more than one transaction?",
        "What should I return if there is no profitable trade?",
      ],
      hints: {
        l1: "If I told you that you had to sell on day i, what would you need to know about the days before it?",
        l2: "Selling on day i is only ever worth it against the cheapest day before i. Can you keep that as you scan?",
        l3: "Track the running minimum price as you walk the array, and at each step compute price minus that minimum.",
        l4: "Initialise minPrice to prices[0] and best to 0. For each price: best = max(best, price - minPrice), then minPrice = min(minPrice, price). Return best.",
      },
    },
  },

  {
    id: "valid-palindrome",
    title: "Valid Palindrome",
    difficulty: "easy",
    category: "Two Pointers",
    description: [
      "A phrase is a palindrome if, after converting all uppercase letters to lowercase and removing every character that is not a letter or a digit, it reads the same forwards and backwards.",
      "Given a string `s`, return `true` if it is a palindrome and `false` otherwise.",
    ],
    examples: [
      {
        input: 's = "A man, a plan, a canal: Panama"',
        output: "true",
        explanation: '"amanaplanacanalpanama" reads the same in both directions.',
      },
      {
        input: 's = "race a car"',
        output: "false",
        explanation: '"raceacar" is not a palindrome.',
      },
      {
        input: 's = " "',
        output: "true",
        explanation: "After filtering, the string is empty, which is a palindrome.",
      },
    ],
    constraints: [
      "1 <= s.length <= 2 * 10^5",
      "s consists only of printable ASCII characters.",
    ],
    functionName: "isPalindrome",
    paramNames: ["s"],
    paramTypes: ["string"],
    returnType: "boolean",
    compare: "exact",
    starter: {
      java: `class Solution {
    public boolean isPalindrome(String s) {
        // Write your solution here
        return false;
    }
}`,
      python: `def isPalindrome(s):
    # Write your solution here
    pass`,
      javascript: `function isPalindrome(s) {
  // Write your solution here
}`,
    },
    tests: [
      { args: ["A man, a plan, a canal: Panama"], expected: true, label: "classic" },
      { args: ["race a car"], expected: false, label: "not a palindrome" },
      { args: [" "], expected: true, label: "only whitespace" },
      { args: ["0P"], expected: false, hidden: true, label: "digit vs letter, case trap" },
      { args: ["aa"], expected: true, hidden: true, label: "two identical letters" },
      { args: [".,"], expected: true, hidden: true, label: "only punctuation" },
      { args: ["ab_a"], expected: true, hidden: true, label: "underscore is not alphanumeric" },
      { args: ["12321"], expected: true, hidden: true, label: "digits" },
      { args: ["1a2"], expected: false, hidden: true, label: "mixed, not a palindrome" },
    ],
    notes: {
      optimal:
        "Two pointers from both ends. Skip non-alphanumeric characters on each side, compare the lowercased characters, and move inwards.",
      optimalTime: "O(n)",
      optimalSpace: "O(1)",
      bruteForce:
        "Build a cleaned, lowercased copy of the string and compare it with its reverse.",
      bruteForceTime: "O(n) time but O(n) extra space",
      pitfalls: [
        "Treating underscore as alphanumeric — many languages' \\w character class includes it.",
        "Comparing a digit against a letter after a careless case conversion ('0' vs 'P').",
        "Advancing only one pointer inside the skip loop and running past the other.",
      ],
      followUps: [
        "Your first version built a cleaned copy. Can you do it without the extra string?",
        "What is the space complexity of each of your two versions?",
        "How would you handle Unicode letters rather than just ASCII?",
      ],
      clarifications: [
        "Should digits count as valid characters?",
        "Is the comparison case-insensitive?",
        "What counts as a character to ignore — just spaces, or all punctuation?",
      ],
      hints: {
        l1: "What does it actually mean for a string to read the same in both directions, in terms of positions?",
        l2: "You are comparing the character at position i with the one at position n-1-i. Can you do that without building a second string?",
        l3: "Use a pointer at each end, walk them towards the middle, and skip anything that is not a letter or digit.",
        l4: "While left < right: advance left while it points at a non-alphanumeric, retreat right while it points at a non-alphanumeric, compare the lowercased characters and return false on a mismatch, otherwise step both inwards.",
      },
    },
  },

  {
    id: "reverse-linked-list",
    title: "Reverse Linked List",
    difficulty: "easy",
    category: "Linked Lists",
    description: [
      "Given the `head` of a singly linked list, reverse the list and return the head of the reversed list.",
      "Each node is defined with a value and a `next` pointer. In the tests below a list is written as an array, so `[1,2,3]` means `1 -> 2 -> 3`.",
    ],
    examples: [
      { input: "head = [1,2,3,4,5]", output: "[5,4,3,2,1]" },
      { input: "head = [1,2]", output: "[2,1]" },
      { input: "head = []", output: "[]", explanation: "An empty list reverses to an empty list." },
    ],
    constraints: [
      "The number of nodes is in the range [0, 5000].",
      "-5000 <= Node.val <= 5000",
    ],
    functionName: "reverseList",
    paramNames: ["head"],
    paramTypes: ["ListNode"],
    returnType: "ListNode",
    compare: "exact",
    starter: {
      java: `/**
 * Definition for singly-linked list:
 * class ListNode {
 *     int val;
 *     ListNode next;
 *     ListNode() {}
 *     ListNode(int val) { this.val = val; }
 *     ListNode(int val, ListNode next) { this.val = val; this.next = next; }
 * }
 */
class Solution {
    public ListNode reverseList(ListNode head) {
        // Write your solution here
        return null;
    }
}`,
      python: `# Definition for singly-linked list:
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next

def reverseList(head):
    # Write your solution here
    pass`,
      javascript: `/**
 * Definition for singly-linked list:
 * function ListNode(val, next) {
 *   this.val = (val === undefined ? 0 : val);
 *   this.next = (next === undefined ? null : next);
 * }
 */
function reverseList(head) {
  // Write your solution here
}`,
    },
    tests: [
      { args: [[1, 2, 3, 4, 5]], expected: [5, 4, 3, 2, 1], label: "five nodes" },
      { args: [[1, 2]], expected: [2, 1], label: "two nodes" },
      { args: [[]], expected: [], label: "empty list" },
      { args: [[1]], expected: [1], hidden: true, label: "single node" },
      { args: [[-1, 0, 1]], expected: [1, 0, -1], hidden: true, label: "negative values" },
      { args: [[7, 7, 7]], expected: [7, 7, 7], hidden: true, label: "repeated values" },
      {
        args: [Array.from({ length: 5000 }, (_, i) => i)],
        expected: Array.from({ length: 5000 }, (_, i) => 4999 - i),
        hidden: true,
        label: "5000 nodes (rejects deep recursion in some runtimes)",
      },
    ],
    notes: {
      optimal:
        "Iterate with three pointers — previous, current and next — rewiring current.next to previous at each step. Return previous at the end.",
      optimalTime: "O(n)",
      optimalSpace: "O(1)",
      bruteForce:
        "Copy every value into an array, reverse it, and rebuild a new list from the values.",
      bruteForceTime: "O(n) time and O(n) extra space",
      pitfalls: [
        "Losing the rest of the list by reassigning current.next before saving it.",
        "Returning head instead of prev, which yields a one-element list.",
        "Not handling an empty list, which crashes on the first dereference.",
        "A recursive solution that overflows the stack on 5000 nodes.",
      ],
      followUps: [
        "Can you write the recursive version, and what is its space complexity?",
        "How would you reverse only the middle section of the list, between positions m and n?",
        "What changes if the list is doubly linked?",
      ],
      clarifications: [
        "Can the list be empty?",
        "Should I reverse in place, or is allocating new nodes acceptable?",
        "Are the values guaranteed unique?",
      ],
      hints: {
        l1: "Think about a single node in the middle. What has to change about it for the list to be reversed?",
        l2: "Each node's next pointer needs to point at the node that used to come before it. What do you need to remember to do that as you walk forward?",
        l3: "Keep three references as you iterate: the previous node, the current node, and the next node you are about to lose.",
        l4: "prev = null, curr = head. While curr is not null: save next = curr.next, set curr.next = prev, then prev = curr and curr = next. Return prev.",
      },
    },
  },
];
