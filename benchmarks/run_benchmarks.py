"""Run repeatable sequential and MPI trials and save raw results."""
import argparse
import csv
import json
import shutil
import subprocess
import sys
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]


def invoke(command):
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=True)
    # MPI launchers may print diagnostic lines alongside the JSON result.
    for line in reversed(completed.stdout.splitlines()):
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    raise RuntimeError("Program did not return a JSON result: " + completed.stdout)


def run_case(size, processes, repeats=3, seed=42, mpiexec="mpiexec"):
    if min(size, processes, repeats) < 1:
        raise ValueError("Size, process count, and repeats must be positive.")
    if not shutil.which(mpiexec):
        raise RuntimeError("MPI launcher not found. Install MPI and make mpiexec available on PATH.")
    common = ["--size", str(size), "--seed", str(seed)]
    seq, parallel = [], []
    for _ in range(repeats):
        seq.append(invoke([sys.executable, "-m", "src.sequential", *common])["seconds"])
        result = invoke([mpiexec, "-n", str(processes), sys.executable, "-m", "src.parallel", *common])
        if not result["correct"]:
            raise RuntimeError("Parallel result did not match the sequential reference.")
        parallel.append(result["seconds"])
    sequential_time, parallel_time = median(seq), median(parallel)
    speedup = sequential_time / parallel_time
    return {"size": size, "processes": processes, "repeats": repeats, "seed": seed,
            "sequential_seconds": sequential_time, "parallel_seconds": parallel_time,
            "speedup": speedup, "efficiency_percent": 100 * speedup / processes,
            "correct": True, "sequential_trials": seq, "parallel_trials": parallel}


def main():
    parser = argparse.ArgumentParser(description="Run matrix multiplication benchmarks")
    parser.add_argument("--sizes", nargs="+", type=int, default=[100, 500, 1000])
    parser.add_argument("--processes", nargs="+", type=int, default=[1, 2, 4])
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--mpiexec", default="mpiexec")
    parser.add_argument("--output", default="results/data/benchmarks.csv")
    args = parser.parse_args()
    rows = []
    for size in args.sizes:
        for processes in args.processes:
            row = run_case(size, processes, args.repeats, args.seed, args.mpiexec)
            rows.append(row)
            print(json.dumps(row), flush=True)
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {output}")


if __name__ == "__main__":
    main()
