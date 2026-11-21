pipeline {
    agent any

    options {
        timestamps()
        skipDefaultCheckout(true)
    }

    tools {
        nodejs 'NodeJS-24'
    }

    environment {
        CI = 'true'
        // CI builds and tests the demo (fake data in the browser). The real site is built with its own values.
        NEXT_PUBLIC_USE_MOCK = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Type Check') {
            steps {
                sh 'npm run typecheck'
            }
        }

        stage('Unit Tests') {
            steps {
                sh 'npm test'
            }
        }

        stage('Real Build Has No Demo Data') {
            steps {
                // Build the site as the real one, and fail if a demo account or password is in its files.
                sh 'NEXT_PUBLIC_USE_MOCK=false npm run build'
                sh 'npm run check:no-demo'
            }
        }

        stage('Cloudflare Pages Build') {
            steps {
                // The same real site as plain files (out/), as Cloudflare Pages builds it; checked for demo data too.
                sh 'NEXT_PUBLIC_USE_MOCK=false npm run build:static'
                sh 'npm run check:no-demo'
            }
        }

        stage('Build') {
            steps {
                // The demo build, for the browser tests below.
                sh 'npm run build'
            }
        }

        stage('Browser Tests') {
            steps {
                sh 'npx playwright install --with-deps chromium'
                sh 'npm run test:e2e'
            }
        }
    }

    post {
        success {
            echo 'CI PIPELINE SUCCESSFUL!'
        }
        failure {
            echo 'CI PIPELINE FAILED!'
        }
    }
}
