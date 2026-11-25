"""Sequential baseline. Run with python -m src.sequential."""
import argparse
import json
from time import perf_counter
from .matrix_utils import make_matrices, multiply


def main():
    parser = argparse.ArgumentParser(description="Sequential matrix multiplication")
    parser.add_argument("--size", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    a, b = make_matrices(args.size, args.seed)
    start = perf_counter()
    result = multiply(a, b)
    elapsed = perf_counter() - start
    print(json.dumps({"size": args.size, "seed": args.seed, "seconds": elapsed,
                      "checksum": float(result.sum())}))


if __name__ == "__main__":
    main()
