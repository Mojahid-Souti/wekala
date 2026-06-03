"""Entrypoint: ``python -m wekala.worker`` runs the KB document-processing loop."""

import asyncio

from wekala.worker.runner import run

if __name__ == "__main__":
    asyncio.run(run())
