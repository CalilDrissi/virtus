from setuptools import setup, find_packages

setup(
    name="virtus-sdk",
    version="1.0.0",
    description="Python SDK for Virtus AI Platform",
    author="Virtus AI",
    packages=find_packages(),
    python_requires=">=3.8",
    install_requires=[
        "httpx>=0.25.0",
    ],
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
