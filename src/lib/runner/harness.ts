import type { Language, Problem, ValueType } from "@/lib/types";

export interface HarnessPlan {
  files: Record<string, string>;
  /** Optional compile step; a non-zero exit is reported as a compile error. */
  compile?: { cmd: string; args: string[] };
  run: { cmd: string; args: string[] };
  /** Line-delimited JSON results, appended synchronously so a kill -9 keeps them. */
  resultsFile: string;
}

// ---------------------------------------------------------------------------
// Java literal + type generation
// ---------------------------------------------------------------------------

/** The Java type used for a parameter or return slot. */
function javaType(t: ValueType): string {
  switch (t) {
    case "int":
      return "int";
    case "boolean":
      return "boolean";
    case "string":
      return "String";
    case "int[]":
      return "int[]";
    case "int[][]":
      return "int[][]";
    case "string[]":
      return "String[]";
    case "char[][]":
      return "char[][]";
    case "ListNode":
      return "ListNode";
    case "TreeNode":
      return "TreeNode";
    case "string[][]":
      return "List<List<String>>";
    case "int[][]?":
      return "List<List<Integer>>";
  }
}

/**
 * Test data goes into a side file rather than inlined Java literals: a
 * 20,000-element array literal blows past the JVM's 64KB per-method bytecode
 * limit ("code too large"). Reading it back in a loop keeps the generated
 * harness a constant size no matter how big the test data gets.
 */
function encodeJavaValue(t: ValueType, v: unknown): string[] {
  const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");
  switch (t) {
    case "int":
      return [String(v)];
    case "boolean":
      return [v ? "true" : "false"];
    case "string":
      return [b64(String(v))];
    case "int[]":
      return [((v as number[]) ?? []).join(" ")];
    case "int[][]": {
      const rows = (v as number[][]) ?? [];
      return [String(rows.length), ...rows.map((r) => r.join(" "))];
    }
    case "string[]": {
      const items = (v as string[]) ?? [];
      return [String(items.length), ...items.map(b64)];
    }
    case "char[][]": {
      const rows = (v as string[][]) ?? [];
      return [String(rows.length), ...rows.map((r) => b64(r.join("")))];
    }
    case "ListNode":
      return [((v as number[]) ?? []).join(" ")];
    case "TreeNode":
      return [
        ((v as (number | null)[]) ?? [])
          .map((x) => (x === null ? "#" : String(x)))
          .join(" "),
      ];
    default:
      throw new Error(`${t} is not usable as a parameter type`);
  }
}

/** The reader call that reconstructs a parameter of the given type. */
function javaReader(t: ValueType): string {
  switch (t) {
    case "int":
      return "__readInt()";
    case "boolean":
      return "__readBool()";
    case "string":
      return "__readStr()";
    case "int[]":
      return "__readInts()";
    case "int[][]":
      return "__readInts2()";
    case "string[]":
      return "__readStrs()";
    case "char[][]":
      return "__readChars2()";
    case "ListNode":
      return "__readList()";
    case "TreeNode":
      return "__readTree()";
    default:
      throw new Error(`${t} is not usable as a parameter type`);
  }
}

const JAVA_SUPPORT = `
    // ---- harness support -------------------------------------------------
    static java.nio.file.Path __out;
    static java.io.BufferedReader __br;

    static String __line() throws Exception {
        String s = __br.readLine();
        return s == null ? "" : s;
    }
    static int __readInt() throws Exception { return Integer.parseInt(__line().trim()); }
    static boolean __readBool() throws Exception { return Boolean.parseBoolean(__line().trim()); }
    static String __readStr() throws Exception {
        return new String(java.util.Base64.getDecoder().decode(__line().trim()),
                java.nio.charset.StandardCharsets.UTF_8);
    }
    static int[] __readInts() throws Exception {
        String s = __line().trim();
        if (s.isEmpty()) return new int[0];
        String[] parts = s.split(" ");
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) out[i] = Integer.parseInt(parts[i]);
        return out;
    }
    static int[][] __readInts2() throws Exception {
        int rows = __readInt();
        int[][] out = new int[rows][];
        for (int i = 0; i < rows; i++) out[i] = __readInts();
        return out;
    }
    static String[] __readStrs() throws Exception {
        int n = __readInt();
        String[] out = new String[n];
        for (int i = 0; i < n; i++) out[i] = __readStr();
        return out;
    }
    static char[][] __readChars2() throws Exception {
        int rows = __readInt();
        char[][] out = new char[rows][];
        for (int i = 0; i < rows; i++) out[i] = __readStr().toCharArray();
        return out;
    }
    static ListNode __readList() throws Exception { return __listOf(__readInts()); }
    static TreeNode __readTree() throws Exception {
        String s = __line().trim();
        if (s.isEmpty()) return null;
        String[] parts = s.split(" ");
        Integer[] vals = new Integer[parts.length];
        for (int i = 0; i < parts.length; i++) {
            vals[i] = parts[i].equals("#") ? null : Integer.valueOf(parts[i]);
        }
        return __treeOf(vals);
    }

    static ListNode __listOf(int[] vals) {
        ListNode dummy = new ListNode(0);
        ListNode cur = dummy;
        for (int v : vals) { cur.next = new ListNode(v); cur = cur.next; }
        return dummy.next;
    }

    static TreeNode __treeOf(Integer[] vals) {
        if (vals.length == 0 || vals[0] == null) return null;
        TreeNode root = new TreeNode(vals[0]);
        java.util.Deque<TreeNode> q = new java.util.ArrayDeque<>();
        q.add(root);
        int i = 1;
        while (!q.isEmpty() && i < vals.length) {
            TreeNode node = q.poll();
            if (i < vals.length) {
                if (vals[i] != null) { node.left = new TreeNode(vals[i]); q.add(node.left); }
                i++;
            }
            if (i < vals.length) {
                if (vals[i] != null) { node.right = new TreeNode(vals[i]); q.add(node.right); }
                i++;
            }
        }
        return root;
    }

    static String __esc(String s) {
        StringBuilder sb = new StringBuilder("\\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\\\\""); break;
                case '\\\\': sb.append("\\\\\\\\"); break;
                case '\\n': sb.append("\\\\n"); break;
                case '\\r': sb.append("\\\\r"); break;
                case '\\t': sb.append("\\\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append('"').toString();
    }

    @SuppressWarnings("rawtypes")
    static String __json(Object o) {
        if (o == null) return "null";
        if (o instanceof String) return __esc((String) o);
        if (o instanceof Character) return __esc(String.valueOf(o));
        if (o instanceof Boolean || o instanceof Integer || o instanceof Long
                || o instanceof Short || o instanceof Byte) return o.toString();
        if (o instanceof Double || o instanceof Float) {
            double d = ((Number) o).doubleValue();
            if (d == Math.rint(d) && !Double.isInfinite(d)) return String.valueOf((long) d);
            return String.valueOf(d);
        }
        if (o instanceof ListNode) {
            StringBuilder sb = new StringBuilder("[");
            ListNode n = (ListNode) o;
            boolean first = true;
            int guard = 0;
            while (n != null && guard++ < 100000) {
                if (!first) sb.append(',');
                sb.append(n.val);
                first = false;
                n = n.next;
            }
            return sb.append(']').toString();
        }
        if (o instanceof TreeNode) {
            java.util.List<String> out = new java.util.ArrayList<>();
            java.util.Deque<TreeNode> q = new java.util.ArrayDeque<>();
            q.add((TreeNode) o);
            while (!q.isEmpty()) {
                TreeNode n = q.poll();
                if (n == null) { out.add("null"); continue; }
                out.add(String.valueOf(n.val));
                q.add(n.left);
                q.add(n.right);
            }
            while (!out.isEmpty() && out.get(out.size() - 1).equals("null")) out.remove(out.size() - 1);
            return "[" + String.join(",", out) + "]";
        }
        if (o instanceof java.util.Collection) {
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : (java.util.Collection) o) {
                if (!first) sb.append(',');
                sb.append(__json(item));
                first = false;
            }
            return sb.append(']').toString();
        }
        if (o.getClass().isArray()) {
            StringBuilder sb = new StringBuilder("[");
            int n = java.lang.reflect.Array.getLength(o);
            for (int i = 0; i < n; i++) {
                if (i > 0) sb.append(',');
                sb.append(__json(java.lang.reflect.Array.get(o, i)));
            }
            return sb.append(']').toString();
        }
        return __esc(String.valueOf(o));
    }

    // Type-directed entry points. A null list or tree head must serialise as an
    // empty array to match the JavaScript and Python harnesses, whereas bare
    // __json(null) would render the JSON literal null.
    static String __jsonList(ListNode n) { return n == null ? "[]" : __json(n); }
    static String __jsonTree(TreeNode n) { return n == null ? "[]" : __json(n); }

    static void __emit(int i, boolean ok, String out, String err, String stdout, long startNs) {
        long ms = (System.nanoTime() - startNs) / 1000000L;
        String line = "{\\"i\\":" + i + ",\\"ok\\":" + ok + ",\\"out\\":" + out
                + ",\\"err\\":" + (err == null ? "null" : __esc(err))
                + ",\\"stdout\\":" + __esc(stdout)
                + ",\\"ms\\":" + ms + "}\\n";
        try {
            java.nio.file.Files.write(__out, line.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.APPEND);
        } catch (Exception e) {
            System.err.println("harness write failed: " + e);
        }
    }

    static String __trace(Throwable t) {
        java.io.StringWriter sw = new java.io.StringWriter();
        t.printStackTrace(new java.io.PrintWriter(sw));
        String s = sw.toString();
        return s.length() > 2000 ? s.substring(0, 2000) + "..." : s;
    }
`;

function buildJavaHarness(problem: Problem, code: string): HarnessPlan {
  const ret = javaType(problem.returnType);
  const serialise =
    problem.returnType === "ListNode"
      ? "__jsonList"
      : problem.returnType === "TreeNode"
        ? "__jsonTree"
        : "__json";

  const dataLines: string[] = [];
  for (const test of problem.tests) {
    problem.paramTypes.forEach((t, j) => {
      dataLines.push(...encodeJavaValue(t, test.args[j]));
    });
  }

  const decls = problem.paramTypes
    .map((t, j) => `            ${javaType(t)} __a${j} = ${javaReader(t)};`)
    .join("\n");
  const argList = problem.paramTypes.map((_, j) => `__a${j}`).join(", ");

  const needsListNode =
    problem.paramTypes.includes("ListNode") || problem.returnType === "ListNode";
  const needsTreeNode =
    problem.paramTypes.includes("TreeNode") || problem.returnType === "TreeNode";

  const files: Record<string, string> = {
    // java.util.* is pre-imported the way an online judge would. The candidate's
    // own imports still land before their class, so they stay legal.
    "Solution.java": `import java.util.*;\n\n${code}\n`,
    "tests.txt": `${dataLines.join("\n")}\n`,
    "Main.java": `import java.util.*;

public class Main {
    public static void main(String[] __args) throws Exception {
        __out = java.nio.file.Paths.get(__args[0]);
        __br = java.nio.file.Files.newBufferedReader(java.nio.file.Paths.get(__args[1]),
                java.nio.charset.StandardCharsets.UTF_8);
        for (int __i = 0; __i < ${problem.tests.length}; __i++) {
${decls}
            java.io.ByteArrayOutputStream __buf = new java.io.ByteArrayOutputStream();
            java.io.PrintStream __orig = System.out;
            long __t0 = System.nanoTime();
            try {
                System.setOut(new java.io.PrintStream(__buf, true, "UTF-8"));
                ${ret} __r = new Solution().${problem.functionName}(${argList});
                System.setOut(__orig);
                __emit(__i, true, ${serialise}(__r), null, __buf.toString("UTF-8"), __t0);
            } catch (Throwable __e) {
                System.setOut(__orig);
                __emit(__i, false, "null", __trace(__e), __buf.toString("UTF-8"), __t0);
            } finally {
                System.setOut(__orig);
            }
        }
    }
${JAVA_SUPPORT}
}
`,
  };

  files["ListNode.java"] = needsListNode
    ? `class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
`
    : // A stub keeps __json's instanceof checks compiling for problems whose
      // signature contains no linked list.
      `class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }\n`;

  files["TreeNode.java"] = needsTreeNode
    ? `class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val; this.left = left; this.right = right;
    }
}
`
    : `class TreeNode { int val; TreeNode left; TreeNode right; TreeNode(int val) { this.val = val; } }\n`;

  return {
    files,
    compile: {
      cmd: "javac",
      args: ["-nowarn", "-d", ".", "Solution.java", "ListNode.java", "TreeNode.java", "Main.java"],
    },
    run: {
      cmd: "java",
      args: ["-Xss512m", "-cp", ".", "Main", "results.jsonl", "tests.txt"],
    },
    resultsFile: "results.jsonl",
  };
}

// ---------------------------------------------------------------------------
// JavaScript
// ---------------------------------------------------------------------------

function buildJavaScriptHarness(problem: Problem, code: string): HarnessPlan {
  const payload = JSON.stringify({
    fn: problem.functionName,
    paramTypes: problem.paramTypes,
    returnType: problem.returnType,
    tests: problem.tests.map((t) => t.args),
  });

  const main = `${code}

// ===== harness (appended by the interview runner) =====
;(async () => {
const __fs = await import("node:fs");
const __spec = ${payload};
const __outPath = process.argv[2];

function ListNode(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; }
function TreeNode(val, left, right) {
  this.val = val === undefined ? 0 : val;
  this.left = left === undefined ? null : left;
  this.right = right === undefined ? null : right;
}
globalThis.ListNode = globalThis.ListNode || ListNode;
globalThis.TreeNode = globalThis.TreeNode || TreeNode;

function __buildList(arr) {
  let head = null;
  for (let i = arr.length - 1; i >= 0; i--) head = new ListNode(arr[i], head);
  return head;
}
function __buildTree(arr) {
  if (!arr.length || arr[0] === null) return null;
  const root = new TreeNode(arr[0]);
  const q = [root];
  let i = 1;
  while (q.length && i < arr.length) {
    const node = q.shift();
    if (i < arr.length) { if (arr[i] !== null) { node.left = new TreeNode(arr[i]); q.push(node.left); } i++; }
    if (i < arr.length) { if (arr[i] !== null) { node.right = new TreeNode(arr[i]); q.push(node.right); } i++; }
  }
  return root;
}
function __build(type, value) {
  if (type === "ListNode") return __buildList(value ?? []);
  if (type === "TreeNode") return __buildTree(value ?? []);
  return value;
}
function __serialiseList(node) {
  const out = [];
  let guard = 0;
  while (node && guard++ < 100000) { out.push(node.val); node = node.next; }
  return out;
}
function __serialiseTree(node) {
  if (!node) return [];
  const out = [];
  const q = [node];
  while (q.length) {
    const n = q.shift();
    if (n === null || n === undefined) { out.push(null); continue; }
    out.push(n.val);
    q.push(n.left ?? null, n.right ?? null);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
function __serialise(type, value) {
  if (value === undefined) return null;
  if (type === "ListNode") return __serialiseList(value);
  if (type === "TreeNode") return __serialiseTree(value);
  if (value instanceof Map) return Object.fromEntries(value);
  if (value instanceof Set) return [...value];
  return value;
}

// Resolve the candidate's function: a bare declaration, or a Solution class.
let __fn;
try { __fn = eval(__spec.fn); } catch { __fn = undefined; }
if (typeof __fn !== "function") {
  try {
    const S = eval("Solution");
    if (typeof S === "function" && typeof S.prototype?.[__spec.fn] === "function") {
      const inst = new S();
      __fn = (...a) => inst[__spec.fn](...a);
    }
  } catch { /* no Solution class either */ }
}

function __write(obj) {
  __fs.appendFileSync(__outPath, JSON.stringify(obj) + "\\n");
}

if (typeof __fn !== "function") {
  for (let i = 0; i < __spec.tests.length; i++) {
    __write({ i, ok: false, out: null, ms: 0, stdout: "",
      err: "No function named '" + __spec.fn + "' was found. Define it at the top level, e.g. function " + __spec.fn + "(...) { }" });
  }
  process.exit(0);
}

const __realWrite = process.stdout.write.bind(process.stdout);
for (let i = 0; i < __spec.tests.length; i++) {
  const args = __spec.tests[i].map((v, j) => __build(__spec.paramTypes[j], v));
  let captured = "";
  const t0 = process.hrtime.bigint();
  process.stdout.write = (chunk) => { captured += String(chunk); return true; };
  try {
    const raw = __fn(...args);
    const value = raw && typeof raw.then === "function" ? await raw : raw;
    process.stdout.write = __realWrite;
    __write({ i, ok: true, out: __serialise(__spec.returnType, value), err: null,
      stdout: captured.slice(0, 4000), ms: Number((process.hrtime.bigint() - t0) / 1000000n) });
  } catch (e) {
    process.stdout.write = __realWrite;
    __write({ i, ok: false, out: null, err: (e && e.stack ? e.stack : String(e)).slice(0, 2000),
      stdout: captured.slice(0, 4000), ms: Number((process.hrtime.bigint() - t0) / 1000000n) });
  } finally {
    process.stdout.write = __realWrite;
  }
}
})();
`;

  return {
    files: { "main.mjs": main },
    // No --stack-size override: raising it past the OS thread stack segfaults V8.
    run: { cmd: "node", args: ["main.mjs", "results.jsonl"] },
    resultsFile: "results.jsonl",
  };
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

function buildPythonHarness(problem: Problem, code: string): HarnessPlan {
  const payload = JSON.stringify({
    fn: problem.functionName,
    paramTypes: problem.paramTypes,
    returnType: problem.returnType,
    tests: problem.tests.map((t) => t.args),
  });

  // The candidate's source is embedded as data and exec'd, so their indentation
  // can never be disturbed by the surrounding harness.
  const encoded = Buffer.from(code, "utf8").toString("base64");

  const main = `import base64, io, json, sys, threading, time, traceback, contextlib

sys.setrecursionlimit(100000)

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

SPEC = json.loads(${JSON.stringify(payload)})
OUT_PATH = sys.argv[1]
SOURCE = base64.b64decode("${encoded}").decode("utf-8")

def write(obj):
    with open(OUT_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj) + "\\n")
        f.flush()

def build_list(arr):
    head = None
    for v in reversed(arr or []):
        head = ListNode(v, head)
    return head

def build_tree(arr):
    arr = arr or []
    if not arr or arr[0] is None:
        return None
    root = TreeNode(arr[0])
    queue = [root]
    i = 1
    head = 0
    while head < len(queue) and i < len(arr):
        node = queue[head]
        head += 1
        if i < len(arr):
            if arr[i] is not None:
                node.left = TreeNode(arr[i])
                queue.append(node.left)
            i += 1
        if i < len(arr):
            if arr[i] is not None:
                node.right = TreeNode(arr[i])
                queue.append(node.right)
            i += 1
    return root

def build(kind, value):
    if kind == "ListNode":
        return build_list(value)
    if kind == "TreeNode":
        return build_tree(value)
    return value

def ser_list(node):
    out = []
    guard = 0
    while node is not None and guard < 100000:
        out.append(node.val)
        node = node.next
        guard += 1
    return out

def ser_tree(node):
    if node is None:
        return []
    out = []
    queue = [node]
    head = 0
    while head < len(queue):
        n = queue[head]
        head += 1
        if n is None:
            out.append(None)
            continue
        out.append(n.val)
        queue.append(n.left)
        queue.append(n.right)
    while out and out[-1] is None:
        out.pop()
    return out

def serialise(kind, value):
    if kind == "ListNode":
        return ser_list(value)
    if kind == "TreeNode":
        return ser_tree(value)
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, set):
        return sorted(value, key=lambda x: (str(type(x)), str(x)))
    return value

def run():
    env = {"ListNode": ListNode, "TreeNode": TreeNode, "__name__": "__candidate__"}
    try:
        exec(compile(SOURCE, "solution.py", "exec"), env)
    except Exception:
        err = traceback.format_exc()[-2000:]
        for i in range(len(SPEC["tests"])):
            write({"i": i, "ok": False, "out": None, "err": err, "stdout": "", "ms": 0})
        return

    fn = env.get(SPEC["fn"])
    if fn is None:
        solution_cls = env.get("Solution")
        if solution_cls is not None and hasattr(solution_cls, SPEC["fn"]):
            instance = solution_cls()
            fn = getattr(instance, SPEC["fn"])
    if not callable(fn):
        msg = ("No function named '" + SPEC["fn"] + "' was found. "
               "Define it at the top level, e.g. def " + SPEC["fn"] + "(...):")
        for i in range(len(SPEC["tests"])):
            write({"i": i, "ok": False, "out": None, "err": msg, "stdout": "", "ms": 0})
        return

    for i, raw_args in enumerate(SPEC["tests"]):
        args = [build(SPEC["paramTypes"][j], v) for j, v in enumerate(raw_args)]
        buf = io.StringIO()
        t0 = time.perf_counter()
        try:
            with contextlib.redirect_stdout(buf):
                value = fn(*args)
            write({"i": i, "ok": True, "out": serialise(SPEC["returnType"], value), "err": None,
                   "stdout": buf.getvalue()[:4000], "ms": int((time.perf_counter() - t0) * 1000)})
        except Exception:
            write({"i": i, "ok": False, "out": None, "err": traceback.format_exc()[-2000:],
                   "stdout": buf.getvalue()[:4000], "ms": int((time.perf_counter() - t0) * 1000)})

# A roomy stack so an idiomatic recursive solution is not punished for it.
threading.stack_size(256 * 1024 * 1024)
thread = threading.Thread(target=run)
thread.start()
thread.join()
`;

  return {
    files: { "main.py": main },
    run: { cmd: "python3", args: ["main.py", "results.jsonl"] },
    resultsFile: "results.jsonl",
  };
}

export function buildHarness(
  problem: Problem,
  code: string,
  language: Language,
): HarnessPlan {
  switch (language) {
    case "java":
      return buildJavaHarness(problem, code);
    case "javascript":
      return buildJavaScriptHarness(problem, code);
    case "python":
      return buildPythonHarness(problem, code);
  }
}
