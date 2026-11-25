import unittest
import numpy as np
from src.matrix_utils import make_matrices, multiply, row_partition


class MatrixTests(unittest.TestCase):
    def test_known_product(self):
        a = np.array([[1., 2.], [3., 4.]])
        b = np.array([[5., 6.], [7., 8.]])
        np.testing.assert_array_equal(multiply(a, b), [[19., 22.], [43., 50.]])

    def test_uneven_partition_reconstructs_product(self):
        a, b = make_matrices(5)
        counts, offsets = row_partition(5, 3)
        self.assertEqual(counts, [2, 2, 1])
        pieces = [multiply(a[start:start + count], b) for start, count in zip(offsets, counts)]
        np.testing.assert_allclose(np.concatenate(pieces), multiply(a, b))

    def test_more_processes_than_rows(self):
        self.assertEqual(row_partition(2, 4), ([1, 1, 0, 0], [0, 1, 2, 2]))


if __name__ == "__main__":
    unittest.main()
