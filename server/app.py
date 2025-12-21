from flask import Flask
from routes import bp as routes_bp
from database import init_db
import os


def create_app():
    app = Flask(__name__)
    app.config["DATABASE_PATH"] = os.environ.get("SMART_LOCK_DB", os.path.join(os.path.dirname(__file__), "smartlock.db"))

    init_db(app)
    app.register_blueprint(routes_bp)
    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)

