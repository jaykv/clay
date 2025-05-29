#!/usr/bin/env python3
"""
Create a simple Phoenix launcher that installs Phoenix on first run.
This avoids the GraphQL schema issues with bundled .pyz files.
"""

import os
import sys
import zipfile
from pathlib import Path

def create_phoenix_launcher():
    """Create a simple Phoenix launcher .pyz file."""

    output_path = Path(__file__).parent.parent / "phoenix.pyz"

    # Create the launcher script
    launcher_script = '''#!/usr/bin/env python3
"""
Phoenix Launcher - Installs and runs Arize Phoenix
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path

def ensure_phoenix_installed():
    """Ensure Phoenix is installed in a local directory."""

    # Create a local Phoenix installation directory
    clay_dir = Path.home() / ".clay"
    phoenix_dir = clay_dir / "phoenix"
    phoenix_dir.mkdir(parents=True, exist_ok=True)

    # Check if Phoenix is already installed
    phoenix_installed = (phoenix_dir / "lib" / "python" / "site-packages" / "phoenix").exists()

    if not phoenix_installed:
        print("Installing Arize Phoenix...")

        # Install Phoenix to the local directory
        install_cmd = [
            sys.executable, "-m", "pip", "install",
            "--target", str(phoenix_dir / "lib" / "python" / "site-packages"),
            "arize-phoenix", "openai"
        ]

        result = subprocess.run(install_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Failed to install Phoenix: {result.stderr}")
            sys.exit(1)

        print("Phoenix installed successfully!")

    # Add Phoenix to Python path
    phoenix_site_packages = phoenix_dir / "lib" / "python" / "site-packages"
    if str(phoenix_site_packages) not in sys.path:
        sys.path.insert(0, str(phoenix_site_packages))

    return phoenix_site_packages

def main():
    """Main entry point."""

    # Ensure Phoenix is installed
    phoenix_path = ensure_phoenix_installed()

    # Run Phoenix as a subprocess to avoid the GraphQL schema path issues
    try:
        # Set up environment to use our Phoenix installation
        env = os.environ.copy()
        env['PYTHONPATH'] = str(phoenix_path) + os.pathsep + env.get('PYTHONPATH', '')

        # Run Phoenix using the python module execution
        phoenix_cmd = [sys.executable, "-m", "phoenix.server.main"] + sys.argv[1:]

        # Execute Phoenix
        result = subprocess.run(phoenix_cmd, env=env)
        sys.exit(result.returncode)

    except Exception as e:
        print(f"Error running Phoenix: {e}")
        print("Try deleting ~/.clay/phoenix and running again")
        sys.exit(1)

if __name__ == "__main__":
    main()
'''

    # Create the .pyz file
    print(f"Creating Phoenix launcher at {output_path}")

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("__main__.py", launcher_script)

    # Make executable
    os.chmod(output_path, 0o755)

    print(f"✅ Phoenix launcher created at {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.1f} KB")
    print("This launcher will install Phoenix on first run to ~/.clay/phoenix")

    return output_path

if __name__ == "__main__":
    create_phoenix_launcher()
