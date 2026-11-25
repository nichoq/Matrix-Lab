

<!-- Start of picture text -->
8} De La Salle University - Dasmarifias (aa)<br>\@Y COLLEGE OF INFORMATION AND COMPUTER STUDIES “LS,<br><!-- End of picture text -->

## **PARALLEL MATRIX MULTIPLICATION USING MPI: A COMPARATIVE PERFORMANCE ANALYSIS OF SEQUENTIAL AND PARALLEL COMPUTING** 

Submitted in Partial Fulfillment 

Of the Requirement for the Degree 

Bachelor of Science in Computer Science with Intelligent Systems Track 



Bongon, Jason B. 

Sangria, Dave Clarence B. 

Quizo, Nicholas Jere M. 



Mr. Allen Joseph Ong 

Professor 



November 2026 



<!-- Start of picture text -->
8} De La Salle University - Dasmarifias (aa)<br>\@Y COLLEGE OF INFORMATION AND COMPUTER STUDIES “LS,<br><!-- End of picture text -->

# **1.1 Background of the Problem** 

Computers are used to perform different types of calculations in fields like engineering, data analysis, and computer science. However, some calculations take longer to finish, especially when working with large amounts of data. One example is matrix multiplication, which is commonly used in machine learning, image processing, and other applications that involve mathematical computations. 

Matrix multiplication is a process where two matrices are multiplied to produce a new matrix. For smaller matrices, the calculations can be completed in a short amount of time. However, as the matrix size increases, more calculations are needed, which can also increase the execution time. This can be a problem in sequential computing since only one process handles the calculations. 

One possible solution is parallel computing, which allows a program to divide its workload among multiple processes. Instead of having one process complete the entire task, different processes can work on separate parts at the same time. This can be done using the Message Passing Interface (MPI), which allows processes to communicate and share data with one another. 

For this project, we will create a matrix multiplication program using both sequential and parallel computing. We will use MPI for the parallel version and compare how both programs perform when multiplying matrices of different sizes. The main purpose is to find out if dividing the calculations among multiple processes can help reduce the execution time. 

# **1.2 Problem Statement** 

Matrix multiplication can take more time to complete as the size of the matrices increases. In sequential computing, the calculations are performed by a single process, which means that larger matrices require more work from that process. 

Parallel computing may help reduce the execution time by dividing the calculations among multiple processes. However, using more processes does not always mean that a program will run faster because communication between processes also takes time. 

With this, our project aims to compare sequential and parallel matrix multiplication and determine how MPI affects the performance of the program. 



<!-- Start of picture text -->
8} De La Salle University - Dasmarifias (aa)<br>\@Y COLLEGE OF INFORMATION AND COMPUTER STUDIES “LS,<br><!-- End of picture text -->

Specifically, the project seeks to answer the following questions: 

1. How does the execution time of sequential matrix multiplication change when the matrix size increases? 

2. How does the number of MPI processes affect the execution time of parallel matrix multiplication? 

3. How much difference is there between the execution times of sequential and parallel matrix multiplication? 

4. How do matrix size and the number of processes affect the speedup and efficiency of the parallel program? 

# **1.3 Project Objectives** 

## **General Objective** 

The main objective of this project is to develop a parallel matrix multiplication program using MPI and compare its performance with a sequential version. 

## **Specific Objectives** 

1. To implement a sequential matrix multiplication program using Python. 

2. To develop a parallel version of matrix multiplication using MPI to distribute computations among multiple processes. 

3. To test both implementations using matrices of different sizes. 

4. To measure and compare the execution times of sequential and parallel matrix multiplication. 

5. To calculate the speedup and parallel efficiency achieved using different numbers of processes. 

6. To analyze the effectiveness and limitations of parallel computing in performing large-scale mathematical calculations. 

# **1.4 Proposed Solution Using PDC Concepts** 

The proposed project will develop two implementations of matrix multiplication: a sequential version and a parallel version using MPI. The sequential implementation will perform matrix multiplication using a single process. It will serve 



<!-- Start of picture text -->
8} De La Salle University - Dasmarifias (aa)<br>\@Y COLLEGE OF INFORMATION AND COMPUTER STUDIES “LS,<br><!-- End of picture text -->

as the baseline for evaluating the performance of the parallel implementation. The parallel implementation will use MPI to distribute the computational workload among multiple processes. The matrices will be generated using Python, and the multiplication process will be divided into smaller tasks that can be executed simultaneously. 

The parallel computation will follow these steps: 

1. **Matrix Generation:** Generate two square matrices containing numerical values. 

2. **Task Distribution:** Divide the rows of the first matrix among the available MPI processes. 

3. **Parallel Computation:** Each process multiplies its assigned rows by the second matrix to calculate a portion of the resulting matrix. 

4. **Result Collection:** Gather the computed portions from all processes and combine them into the final resulting matrix. 

5. **Result Verification:** Compare the parallel output with the sequential output to verify computational correctness. 

6. **Performance Evaluation:** Measure execution times and calculate speedup and efficiency to determine the effectiveness of parallelization. 

The program will be implemented using Python with the mpi4py library for MPI communication. NumPy may be used for matrix generation and numerical data handling, while the actual multiplication will follow the same calculation method in both implementations to maintain a fair comparison. The project will test different matrix dimensions, such as 100 × 100, 500 × 500, and 1000 × 1000, using 1, 2, and 4 MPI processes, depending on the available hardware. 

Performance will be evaluated using the following metrics: 

- **Execution Time:** The time required to complete matrix multiplication. 

- **Speedup:** The ratio of sequential execution time to parallel execution time. 

- **Parallel Efficiency:** The speedup divided by the number of processes, expressed as a percentage. 

The results will be presented through tables and graphs to compare the performance of both implementations under different testing conditions. 

# **1.5 Brief Explanation** 



<!-- Start of picture text -->
8} De La Salle University - Dasmarifias (aa)<br>\@Y COLLEGE OF INFORMATION AND COMPUTER STUDIES “LS,<br><!-- End of picture text -->

The project will use Message Passing Interface (MPI), a communication standard that allows multiple processes to exchange data and coordinate tasks during parallel computation. 

MPI follows a distributed-memory programming model in which each process operates independently and communicates with other processes through message-passing operations. 

For this project, a data parallelism approach will be applied. The rows of the first matrix will be distributed among multiple processes, allowing each process to perform a portion of the matrix multiplication simultaneously. 

The following MPI operations will be used: 

- **MPI_Scatter:** Distributes portions of the first matrix among the processes. 

- **MPI_Bcast:** Broadcasts the second matrix to all participating processes. 

- **MPI_Gather:** Collects the calculated matrix portions and combines them into the final result. 

The project will also apply workload distribution and process synchronization to coordinate the execution of parallel tasks. By distributing mathematical calculations across multiple processes, the project will demonstrate how parallel computing can reduce computational workload per process and potentially improve execution time. However, the actual performance improvement will depend on factors such as matrix size, process count, and communication overhead. 

Through this implementation, the project will demonstrate the practical application of parallel computing concepts in mathematical calculations and evaluate their effectiveness through measurable performance results. 

