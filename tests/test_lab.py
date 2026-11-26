"""Exercise real MPI data, HTTP validation and local result persistence."""
import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path
from unittest.mock import patch

import numpy as np

from benchmarks.run_benchmarks import run_demo, run_case
from src.matrix_utils import make_matrices
from web import app


class MpiDataTests(unittest.TestCase):
    def test_known_demo_with_idle_ranks(self):
        result = run_demo(2, 4)
        self.assertEqual(result["preview"]["c"], [[19., 22.], [43., 50.]])
        self.assertEqual([p["count"] for p in result["partition"]], [1, 1, 0, 0])
        self.assertNotIn("seconds", result)

    def test_uneven_demo(self):
        result = run_demo(5, 3)
        np.testing.assert_allclose(np.array(result["preview"]["a"]) @ result["preview"]["b"],
                                   result["preview"]["c"])
        self.assertEqual([p["count"] for p in result["partition"]], [2, 2, 1])

    def test_benchmark_preview_is_from_full_product(self):
        result = run_case(7, 3, repeats=2, seed=12)
        a, b = make_matrices(7, 12)
        np.testing.assert_allclose(result["preview"]["c"], (a @ b)[:5, :5])
        self.assertEqual(result["preview"]["total"], 7)
        self.assertEqual(len(result["parallel_trials"]), 2)
        self.assertAlmostEqual(result["speedup"], result["sequential_seconds"] / result["parallel_seconds"])
        self.assertAlmostEqual(result["efficiency_percent"], 100 * result["speedup"] / 3)
        self.assertTrue(result["environment"]["mpi"])


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.port = cls.server.server_port
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path, data=None, origin=True):
        connection = HTTPConnection("127.0.0.1", self.port, timeout=30)
        headers = {"Content-Type": "application/json"}
        if origin:
            headers["Origin"] = f"http://127.0.0.1:{self.port}"
        connection.request("GET" if data is None else "POST", path,
                           None if data is None else json.dumps(data), headers)
        response = connection.getresponse()
        status, body = response.status, response.read()
        connection.close()
        return status, body

    def test_validation_and_origin(self):
        for data in ([], {"size": True, "processes": 2, "repeats": 1},
                     {"size": 3, "processes": 2, "repeats": 1, "seed": -1}):
            self.assertEqual(self.request("/api/run", data)[0], 400)
        self.assertEqual(self.request("/api/demo", {"size": 6, "processes": 2})[0], 400)
        self.assertEqual(self.request("/api/demo", {"size": 2, "processes": 2}, origin=False)[0], 403)

    def test_saved_benchmark_and_demo_separation(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(app, "HISTORY", Path(directory) / "history.jsonl"):
            status, body = self.request("/api/run", {"size": 5, "processes": 2, "repeats": 1, "seed": 7})
            self.assertEqual(status, 200, body)
            result = json.loads(body)
            self.assertEqual(app.read_history(), [result])
            self.assertEqual(json.loads(self.request("/api/history")[1]), [result])
            status, body = self.request("/api/demo", {"size": 2, "processes": 4})
            self.assertEqual(status, 200, body)
            self.assertEqual(json.loads(body)["preview"]["c"][0][0], 19)
            self.assertEqual(len(app.read_history()), 1)

    def test_overlapping_run_rejected(self):
        with app.LOCK:
            self.assertEqual(self.request("/api/demo", {"size": 2, "processes": 2})[0], 409)


if __name__ == "__main__":
    unittest.main()
