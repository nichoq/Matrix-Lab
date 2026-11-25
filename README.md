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

The browser runs one configuration at a time and displays a comparison chart. The command-line benchmark writes median and individual trial times to `results/data/benchmarks.csv`. Generated CSV and graph files are ignored by Git by default.

## Measurement and interpretation

Both implementations use the same NumPy multiplication kernel, restricted to one numerical-library thread per process. The sequential timer covers multiplication. The MPI timer starts after input generation and synchronization; it includes distributing rows of A, broadcasting B, local multiplication, and gathering the result. The reported MPI time is the maximum elapsed time across ranks. Both timers exclude process startup, matrix generation, and correctness verification.

Inputs are reproducible for a given size and seed. The full parallel output is compared with a sequential product using `numpy.allclose`.

- **Speedup** = sequential median time / parallel median time.
- **Efficiency** = speedup / number of processes × 100%.

Results vary with hardware and software. Record the machine specifications, MPI and Python versions, and trial count when reporting results. Parallel execution may be slower for small matrices because distributing and collecting work takes time.