"""MPI implementation. Run with mpiexec -n 2 python -m src.parallel."""
import argparse
import json
from .matrix_utils import make_matrices, make_demo_matrices, multiply, row_partition
import os
import platform
import numpy as np
from mpi4py import MPI


def main():
    parser = argparse.ArgumentParser(description="MPI matrix multiplication")
    parser.add_argument("--size", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    comm = MPI.COMM_WORLD
    rank, processes = comm.Get_rank(), comm.Get_size()
    n = args.size
    if n < 1:
        parser.error("--size must be at least 1")
    counts, offsets = row_partition(n, processes)
    element_counts = [count * n for count in counts]
    element_offsets = [offset * n for offset in offsets]
    if rank == 0:
        a, b = make_demo_matrices(n) if args.demo else make_matrices(n, args.seed)
        result = np.empty((n, n), dtype=np.float64)
    else:
        a = result = None
        b = np.empty((n, n), dtype=np.float64)
    local_a = np.empty((counts[rank], n), dtype=np.float64)
    local_result = np.empty_like(local_a)

    comm.Barrier()
    start = MPI.Wtime()
    comm.Scatterv([a, element_counts, element_offsets, MPI.DOUBLE] if rank == 0 else None,
                  local_a, root=0)
    comm.Bcast(b, root=0)
    local_result[:] = multiply(local_a, b)
    comm.Gatherv(local_result, [result, element_counts, element_offsets, MPI.DOUBLE]
                 if rank == 0 else None, root=0)
    elapsed = comm.reduce(MPI.Wtime() - start, op=MPI.MAX, root=0)

    if rank == 0:
        # Verification is intentionally outside the measured region.
        reference = multiply(a, b)
        limit = min(n, 5)
        print(json.dumps({"size": n, "seed": args.seed, "processes": processes,
                          "seconds": elapsed, "correct": bool(np.allclose(result, reference)),
                          "checksum": float(result.sum()),
                          "max_absolute_error": float(np.max(np.abs(result - reference))),
                          "preview": {"a": a[:limit, :limit].tolist(),
                                      "b": b[:limit, :limit].tolist(),
                                      "c": result[:limit, :limit].tolist(),
                                      "reference": reference[:limit, :limit].tolist(),
                                      "shown": limit, "total": n},
                          "partition": [{"rank": r, "start": offsets[r], "count": counts[r]}
                                        for r in range(processes)],
                          "environment": {"python": platform.python_version(),
                                          "numpy": np.__version__,
                                          "mpi": MPI.Get_library_version().strip(),
                                          "platform": platform.platform(),
                                          "processor": platform.processor(),
                                          "logical_cpus": os.cpu_count(),
                                          "numerical_threads_per_process": 1}}))


if __name__ == "__main__":
    main()
