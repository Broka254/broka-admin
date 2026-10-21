plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val dashboardUrl: String = (properties["brokaAdminDashboardUrl"] as String?)?.trim().orEmpty()

android {
    namespace = "com.broka.admin"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.broka.admin"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "DASHBOARD_URL", "\"$dashboardUrl\"")
    }

    signingConfigs {
        val keystorePath = System.getenv("BROKA_ADMIN_KEYSTORE_PATH")
        val keystorePassword = System.getenv("BROKA_ADMIN_KEYSTORE_PASSWORD")
        val aliasName = System.getenv("BROKA_ADMIN_KEY_ALIAS")
        val keyPass = System.getenv("BROKA_ADMIN_KEY_PASSWORD")
        if (!keystorePath.isNullOrBlank() && !keystorePassword.isNullOrBlank() && !aliasName.isNullOrBlank() && !keyPass.isNullOrBlank()) {
            create("brokaAdminRelease") {
                storeFile = file(keystorePath)
                storePassword = keystorePassword
                keyAlias = aliasName
                keyPassword = keyPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            val releaseSigning = signingConfigs.findByName("brokaAdminRelease")
            if (releaseSigning != null) {
                signingConfig = releaseSigning
            } else {
                println("WARNING: release signing credentials are absent; assembleRelease will produce an unsigned APK.")
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

tasks.withType<JavaCompile>().configureEach {
    options.compilerArgs.add("-Xlint:deprecation")
}
