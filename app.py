import ast
import operator

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def safe_eval(expr_str):
    """Safely evaluate a mathematical expression using Python AST.

    Prevents arbitrary code execution by restricting nodes strictly to math
    literals and safe binary/unary operators.
    """
    if not expr_str or not isinstance(expr_str, str):
        raise ValueError("Invalid expression format")

    #
    sanitized = (
        expr_str.replace("×", "*")
        .replace("÷", "/")
        .replace("–", "-")
        .replace("—", "-")
        .strip()
    )

    if not sanitized:
        raise ValueError("Expression is empty")

    try:
        node = ast.parse(sanitized, mode="eval")
    except Exception:
        raise ValueError("Invalid syntax")

    def _eval_node(n):
        if isinstance(n, ast.Expression):
            return _eval_node(n.body)
        elif isinstance(n, ast.Constant):  # Python 3.8+
            if isinstance(n.value, (int, float)):
                return n.value
            raise ValueError("Invalid numeric value")
        elif hasattr(ast, 'Num') and isinstance(n, getattr(ast, 'Num')):
            return n.n
        elif isinstance(n, ast.BinOp):
            left = _eval_node(n.left)
            right = _eval_node(n.right)
            op_type = type(n.op)
            if op_type in SAFE_OPERATORS:
                if op_type == ast.Div and right == 0:
                    raise ZeroDivisionError("Cannot divide by zero")
                if op_type == ast.Mod and right == 0:
                    raise ZeroDivisionError("Modulo by zero")
                return SAFE_OPERATORS[op_type](left, right)
            raise ValueError("Unsupported operation")
        elif isinstance(n, ast.UnaryOp):
            operand = _eval_node(n.operand)
            op_type = type(n.op)
            if op_type in SAFE_OPERATORS:
                return SAFE_OPERATORS[op_type](operand)
            raise ValueError("Unsupported unary operator")
        else:
            raise ValueError("Forbidden syntax construct")

    result = _eval_node(node)

    # Format numeric result for crisp clean output
    if isinstance(result, float):
        if result.is_integer():
            return int(result)
        # Round up to 10 decimal places to eliminate IEEE-754 precision artifacts (e.g. 0.1 + 0.2)
        return round(result, 10)

    return result


@app.route("/")
def index():
    """Serve the main calculator HTML page."""
    return render_template("index.html")


@app.route("/calculate", methods=["POST"])
def calculate():
    """POST API endpoint for calculating mathematical expressions safely."""
    try:
        data = request.get_json(silent=True) or {}
        expression = data.get("expression", "")

        if not expression:
            return jsonify(
                {"status": "error", "error": "No expression provided"}
            ), 400

        result = safe_eval(expression)
        return jsonify(
            {"status": "success", "expression": expression, "result": result}
        )

    except ZeroDivisionError as e:
        return jsonify({"status": "error", "error": str(e)}), 200
    except ValueError as e:
        return jsonify({"status": "error", "error": str(e)}), 200
    except Exception:
        return jsonify(
            {"status": "error", "error": "Calculation error"}
        ), 200


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
