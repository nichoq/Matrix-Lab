# Matrix Lab

Matrix Lab is a local web app for exploring parallel matrix multiplication. It compares a sequential Python implementation with an MPI implementation, checks that their results match, and displays execution time, speedup, and efficiency.

## Requirements

- Python and pip
- An MPI implementation compatible with mpi4py, with `mpiexec` available on PATH (for example, Microsoft MPI on Windows)
- A browser

See the [mpi4py installation guide](https://mpi4py.readthedocs.io/en/stable/install.html) for compatible MPI runtimes. The interface loads its font and icons from online services.

## Setup and launch on Windows

Open the project folder in VS Code and run these commands in a PowerShell terminal:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m web.app
```

If the browser does not open automatically, visit http://127.0.0.1:5000/. Keep the terminal open while using the app and press Ctrl+C to stop the server. In VS Code, select the `.venv` interpreter using **Python: Select Interpreter**.

If PowerShell prevents activation, use the environment's Python directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m web.app
```

## Running benchmarks and tests

Run these commands from the project root with the virtual environment active:

```powershell
python -m src.sequential --size 100
mpiexec -n 2 python -m src.parallel --size 100
python -m benchmarks.run_benchmarks --sizes 100 500 1000 --processes 1 2 4 --repeats 3
python -m unittest discover -s tests
```

The browser can run an individual configuration or all nine proposal cases (sizes 100, 500, 1000 with 1, 2, 4 processes). The suite runs configurations in sequence, reports progress, and can stop after the current configuration. Completed browser benchmarks are appended to `results/data/experiments.jsonl` and survive browser reloads and server restarts. Demonstrations are not added to benchmark history.

The lab's three tabs keep the numerical demonstration, benchmark workspace, and comparisons on one page. Switching tabs preserves inputs and completed results. Arrow keys, Home and End navigate the tab bar; URL fragments restore the selected workspace on reload.

The lab includes:

- A 2–5 dimensional numerical demonstration computed by real MPI, with selectable output cells, row-by-column products, step playback, and color-coded rank ownership. The inputs are small fixed integers. Playback is an explanation of the computed result, not live MPI instrumentation.
- Full small matrices or top-left 5 × 5 previews of larger benchmark matrices, including the actual gathered C from the final trial. Larger C previews use the full input matrices in their computation. Display rounding does not affect verification.
- History tables with individual trials and machine/software details. Selecting a saved run restores its metrics, previews and partition.
- Time versus size, speedup versus process count, and efficiency versus process count graphs. Graphs use the latest saved run per matrix size/process configuration, regardless of trial count or seed. Point tooltips and the history table retain each run's trial count and seed; settings can differ between plotted points. The sequential time series are paired baselines, not a shared average. Hover points for measurements.
- CSV exports with raw timings and environment metadata, full JSON exports including previews/partitions, and standalone SVG graph downloads.

The command-line benchmark writes median and individual trial times, previews and metadata to `results/data/benchmarks.csv`. Browser history and generated exports are ignored by Git by default. Keep an export of any results used in the paper. Only one MPI calculation runs at a time; the browser demonstration and benchmarks use the same server lock.

The tests include real MPI runs and HTTP/persistence checks, so they require a compatible MPI runtime. On Windows the app also checks the standard Microsoft MPI installation directory if `mpiexec` is not on PATH.

## Measurement and interpretation

Both implementations use the same NumPy multiplication kernel, restricted to one numerical-library thread per process. The sequential timer covers multiplication. The MPI timer starts after input generation and synchronization; it includes distributing rows of A, broadcasting B, local multiplication, and gathering the result. The reported MPI time is the maximum elapsed time across ranks. Both timers exclude process startup, matrix generation, and correctness verification.

Inputs are reproducible for a given size and seed. The full parallel output is compared with a sequential product using `numpy.allclose`.
Verification uses NumPy's default tolerances (`rtol=1e-5`, `atol=1e-8`); the maximum absolute error is also reported. Previews and environment collection happen after timing. Trials have no separate warm-up run. Machine metadata includes logical CPU count (not physical-core count), OS, processor identifier, Python, NumPy and MPI versions. CPU contention, cache state and frequency changes can affect measurements; raw trial times help identify variation.

- **Speedup** = sequential median time / parallel median time.
- **Efficiency** = speedup / number of processes × 100%.

Results vary with hardware and software. Record the machine specifications, MPI and Python versions, and trial count when reporting results. Parallel execution may be slower for small matrices because distributing and collecting work takes time.
