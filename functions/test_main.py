"""
Unit tests for Firebase Cloud Functions
Run with: pytest test_main.py -v
"""

import os
import json
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import pytest

# Set environment variables before importing main
os.environ['ACE_API_KEY'] = 'test-key'
os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-key'
os.environ['GCP_PROJECT'] = 'test-project'

import main


class TestSecretManager:
    """Test Secret Manager integration"""

    @patch('main.secretmanager.SecretManagerServiceClient')
    def test_get_secret_success(self, mock_client):
        """Test successful secret retrieval"""
        mock_response = Mock()
        mock_response.payload.data.decode.return_value = "secret-value"

        mock_client.return_value.access_secret_version.return_value = mock_response

        sm = main.SecretManager(project_id="test-project")
        result = sm.get_secret("TEST_SECRET")

        assert result == "secret-value"

    def test_get_secret_no_client(self):
        """Test secret retrieval without client"""
        sm = main.SecretManager(project_id=None)
        result = sm.get_secret("TEST_SECRET")

        assert result is None


class TestConfig:
    """Test configuration loading"""

    def test_load_config_from_env(self):
        """Test loading configuration from environment"""
        config = main.load_config()

        assert config.ace_api_key == "test-key"
        assert config.supabase_url == "https://test.supabase.co"
        assert config.supabase_key == "test-service-key"

    def test_config_validation(self):
        """Test configuration validation"""
        # Remove required environment variable
        old_value = os.environ.pop('ACE_API_KEY', None)

        with pytest.raises(ValueError, match="ACE_API_KEY not configured"):
            main.load_config()

        # Restore
        if old_value:
            os.environ['ACE_API_KEY'] = old_value


class TestACEAPIClient:
    """Test ACE API client"""

    @pytest.fixture
    def ace_client(self):
        """Create ACE API client fixture"""
        return main.ACEAPIClient(
            api_key="test-key",
            base_url="https://test.aceiot.cloud/api"
        )

    @patch('requests.Session.get')
    def test_fetch_timeseries_success(self, mock_get, ace_client):
        """Test successful timeseries fetch"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "point_samples": [
                {"name": "point1", "time": "2024-01-01T00:00:00Z", "value": 123.45}
            ],
            "next_cursor": "next-page"
        }
        mock_get.return_value = mock_response

        samples, cursor, error = ace_client.fetch_timeseries_page(
            site="test-site",
            start_time="2024-01-01T00:00:00Z",
            end_time="2024-01-01T01:00:00Z"
        )

        assert len(samples) == 1
        assert samples[0]["name"] == "point1"
        assert cursor == "next-page"
        assert error is None

    @patch('requests.Session.get')
    def test_fetch_timeseries_http_error(self, mock_get, ace_client):
        """Test HTTP error handling"""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_response.raise_for_status.side_effect = Exception("HTTP Error")
        mock_get.return_value = mock_response

        samples, cursor, error = ace_client.fetch_timeseries_page(
            site="test-site",
            start_time="2024-01-01T00:00:00Z",
            end_time="2024-01-01T01:00:00Z"
        )

        assert len(samples) == 0
        assert cursor is None
        assert error is not None


class TestSupabaseClient:
    """Test Supabase client"""

    @pytest.fixture
    def supabase_client(self):
        """Create Supabase client fixture"""
        with patch('main.create_client') as mock_create:
            mock_client = Mock()
            mock_create.return_value = mock_client

            client = main.SupabaseClient(
                url="https://test.supabase.co",
                key="test-key"
            )
            return client

    def test_load_point_cache(self, supabase_client):
        """Test loading point cache"""
        mock_response = Mock()
        mock_response.data = [
            {"id": 1, "name": "point1"},
            {"id": 2, "name": "point2"}
        ]

        supabase_client.client.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response

        supabase_client.load_point_cache("test-site")

        assert len(supabase_client.point_cache) == 2
        assert supabase_client.point_cache["point1"] == 1
        assert supabase_client.point_cache["point2"] == 2


class TestDataProcessing:
    """Test data transformation and processing"""

    def test_transform_samples_valid(self):
        """Test transforming valid samples"""
        raw_samples = [
            {
                "name": "point1",
                "time": "2024-01-01T00:00:00Z",
                "value": 123.45
            }
        ]

        point_cache = {"point1": 1}

        transformed = main.transform_samples(raw_samples, point_cache)

        assert len(transformed) == 1
        assert transformed[0]["point_id"] == 1
        assert transformed[0]["value"] == 123.45
        assert "ts" in transformed[0]

    def test_transform_samples_invalid(self):
        """Test handling invalid samples"""
        raw_samples = [
            {"name": "point1", "time": "invalid", "value": 123.45},  # Invalid time
            {"name": "point2", "time": "2024-01-01T00:00:00Z", "value": "invalid"},  # Invalid value
            {"time": "2024-01-01T00:00:00Z", "value": 123.45},  # Missing name
        ]

        point_cache = {"point1": 1, "point2": 2}

        transformed = main.transform_samples(raw_samples, point_cache)

        assert len(transformed) == 0

    def test_deduplicate_samples(self):
        """Test sample deduplication"""
        samples = [
            {"point_id": 1, "ts": "2024-01-01T00:00:00Z", "value": 100},
            {"point_id": 1, "ts": "2024-01-01T00:00:00Z", "value": 200},  # Duplicate
            {"point_id": 2, "ts": "2024-01-01T00:00:00Z", "value": 300},
        ]

        unique = main.deduplicate_samples(samples)

        assert len(unique) == 2
        # Should keep the last value for duplicates
        point1_sample = next(s for s in unique if s["point_id"] == 1)
        assert point1_sample["value"] == 200


class TestCloudFunctions:
    """Test Cloud Functions endpoints"""

    @pytest.fixture
    def mock_request(self):
        """Create mock request fixture"""
        request = Mock()
        request.get_json.return_value = {}
        return request

    @patch('main.load_config')
    @patch('main.ACEAPIClient')
    @patch('main.SupabaseClient')
    def test_continuous_sync_success(self, mock_supabase, mock_ace, mock_config, mock_request):
        """Test successful continuous sync"""
        # Setup mocks
        mock_config.return_value = main.Config(
            ace_api_key="test",
            supabase_url="https://test.supabase.co",
            supabase_key="test"
        )

        mock_supabase_instance = Mock()
        mock_supabase_instance.get_sites_from_db.return_value = ["test-site"]
        mock_supabase_instance.point_cache = {"point1": 1}
        mock_supabase.return_value = mock_supabase_instance

        mock_ace_instance = Mock()
        mock_ace_instance.fetch_timeseries_page.return_value = (
            [{"name": "point1", "time": "2024-01-01T00:00:00Z", "value": 123}],
            None,
            None
        )
        mock_ace.return_value = mock_ace_instance

        # Call function
        response, status_code = main.continuous_sync(mock_request)

        assert status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True

    @patch('main.load_config')
    def test_backfill_historical_missing_params(self, mock_config, mock_request):
        """Test backfill with missing parameters"""
        mock_config.return_value = main.Config(
            ace_api_key="test",
            supabase_url="https://test.supabase.co",
            supabase_key="test"
        )

        mock_request.get_json.return_value = {}  # Missing required params

        response, status_code = main.backfill_historical(mock_request)

        assert status_code == 400
        data = json.loads(response.data)
        assert data["success"] is False
        assert "Missing required parameters" in data["error"]


def test_http_session_creation():
    """Test HTTP session with retry logic"""
    session = main.create_http_session()

    assert session is not None
    assert len(session.adapters) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
