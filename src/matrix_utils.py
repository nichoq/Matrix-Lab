"""Shared, reproducible inputs and multiplication kernel."""
import os

# Each MPI process should use one numerical-library thread for fair comparisons.
for name in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ[name] = "1"

import numpy as np


def make_matrices(size, seed=42):
    if size < 1:
        raise ValueError("Matrix size must be at least 1.")
    rng = np.random.default_rng(seed)
    return rng.random((size, size)), rng.random((size, size))


def multiply(a, b):
    """Use the same numerical kernel in both implementations."""
    return a @ b


def row_partition(size, processes):
    """Return row counts and offsets, including for uneven distributions."""
    base, remainder = divmod(size, processes)
    counts = [base + (rank < remainder) for rank in range(processes)]
    offsets = [sum(counts[:rank]) for rank in range(processes)]
    return counts, offsets
