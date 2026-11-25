"""MPI implementation. Run with mpiexec -n 2 python -m src.parallel."""
import argparse
import json
from .matrix_utils import make_matrices, multiply, row_partition
import numpy as np
from mpi4py import MPI


def main():
    parser = argparse.ArgumentParser(description="MPI matrix multiplication")
    parser.add_argument("--size", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
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
        a, b = make_matrices(n, args.seed)
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
        print(json.dumps({"size": n, "seed": args.seed, "processes": processes,
                          "seconds": elapsed, "correct": bool(np.allclose(result, reference)),
                          "checksum": float(result.sum())}))


if __name__ == "__main__":
    main()
