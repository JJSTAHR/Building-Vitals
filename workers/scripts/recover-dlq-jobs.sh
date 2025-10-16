#!/bin/bash
# DLQ Recovery Tool
# Manually recover jobs from dead letter queue

set -e

echo "🔄 DLQ Recovery Tool"
echo "==================="
echo ""

# Configuration
DB_NAME="building-vitals-db"
WORKER_NAME="building-vitals-worker"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found. Install with: npm install -g wrangler"
    exit 1
fi

# Function to list failed jobs
list_failed_jobs() {
    echo "📋 Fetching failed jobs..."
    echo ""

    wrangler d1 execute "$DB_NAME" --command \
        "SELECT
            job_id,
            site_name,
            substr(error_message, 1, 50) as error,
            retry_count,
            datetime(created_at, 'unixepoch') as created,
            datetime(completed_at, 'unixepoch') as failed_at
        FROM queue_jobs
        WHERE status = 'failed'
        ORDER BY completed_at DESC
        LIMIT 20" --json
}

# Function to get job details
get_job_details() {
    local job_id=$1

    echo "📄 Job Details for: $job_id"
    echo ""

    wrangler d1 execute "$DB_NAME" --command \
        "SELECT * FROM queue_jobs WHERE job_id = '$job_id'" --json
}

# Function to get DLQ stats
get_dlq_stats() {
    echo "📊 DLQ Statistics"
    echo "================="
    echo ""

    wrangler d1 execute "$DB_NAME" --command \
        "SELECT
            COUNT(*) as total_failed,
            COUNT(CASE WHEN created_at > strftime('%s', 'now', '-24 hours') THEN 1 END) as last_24h,
            AVG(retry_count) as avg_retries,
            MAX(datetime(completed_at, 'unixepoch')) as last_failure
        FROM queue_jobs
        WHERE status = 'failed'" --json
}

# Function to requeue a job
requeue_job() {
    local job_id=$1

    echo "🔄 Re-queuing job: $job_id"
    echo ""

    # Get job data
    local job_data=$(wrangler d1 execute "$DB_NAME" --command \
        "SELECT site_name, points_json, start_time, end_time, user_id
         FROM queue_jobs
         WHERE job_id = '$job_id'" --json)

    if [ -z "$job_data" ]; then
        echo "❌ Job not found: $job_id"
        return 1
    fi

    # Reset job status
    wrangler d1 execute "$DB_NAME" --command \
        "UPDATE queue_jobs
         SET status = 'queued',
             retry_count = 0,
             error_message = NULL,
             started_at = NULL,
             completed_at = NULL,
             created_at = strftime('%s', 'now')
         WHERE job_id = '$job_id'"

    echo "✅ Job re-queued successfully!"
    echo ""
    echo "Monitor progress with:"
    echo "  wrangler tail $WORKER_NAME"
}

# Function to abandon a job
abandon_job() {
    local job_id=$1

    echo "🗑️  Abandoning job: $job_id"

    wrangler d1 execute "$DB_NAME" --command \
        "DELETE FROM queue_jobs WHERE job_id = '$job_id'"

    echo "✅ Job abandoned and removed from database"
}

# Function to export failed jobs
export_failed_jobs() {
    local output_file="dlq-failures-$(date +%Y%m%d-%H%M%S).json"

    echo "💾 Exporting failed jobs to: $output_file"

    wrangler d1 execute "$DB_NAME" --command \
        "SELECT * FROM queue_jobs WHERE status = 'failed' ORDER BY completed_at DESC" \
        --json > "$output_file"

    echo "✅ Export complete: $output_file"
}

# Function to view recovery queue
view_recovery_queue() {
    echo "🔍 Recovery Queue"
    echo "================="
    echo ""

    wrangler d1 execute "$DB_NAME" --command \
        "SELECT
            job_id,
            status,
            datetime(created_at, 'unixepoch') as queued_at,
            notes
        FROM dlq_recovery_queue
        ORDER BY created_at DESC
        LIMIT 20" --json
}

# Main menu
show_menu() {
    echo ""
    echo "What would you like to do?"
    echo ""
    echo "1. List failed jobs"
    echo "2. View DLQ statistics"
    echo "3. View recovery queue"
    echo "4. Get job details"
    echo "5. Re-queue a job"
    echo "6. Abandon a job"
    echo "7. Export all failed jobs"
    echo "8. Exit"
    echo ""
    read -p "Select option (1-8): " choice

    case $choice in
        1)
            list_failed_jobs
            show_menu
            ;;
        2)
            get_dlq_stats
            show_menu
            ;;
        3)
            view_recovery_queue
            show_menu
            ;;
        4)
            read -p "Enter job ID: " job_id
            get_job_details "$job_id"
            show_menu
            ;;
        5)
            read -p "Enter job ID to re-queue: " job_id
            read -p "Are you sure? (y/N): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                requeue_job "$job_id"
            else
                echo "Cancelled"
            fi
            show_menu
            ;;
        6)
            read -p "Enter job ID to abandon: " job_id
            read -p "⚠️  This will permanently delete the job. Are you sure? (y/N): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                abandon_job "$job_id"
            else
                echo "Cancelled"
            fi
            show_menu
            ;;
        7)
            export_failed_jobs
            show_menu
            ;;
        8)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option"
            show_menu
            ;;
    esac
}

# Start the tool
show_menu
