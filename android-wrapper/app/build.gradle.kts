import org.gradle.api.GradleException
import java.net.URI

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val approvedDashboardHost = "broka-admin-production.up.railway.app"
val dashboardUrl: String = (properties["brokaAdminDashboardUrl"] as String?)?.trim().orEmpty()

fun dashboardUrlRejectionReason(): String {
    if (dashboardUrl.isEmpty()) {
        return "brokaAdminDashboardUrl is empty. It must be an HTTPS URL on the approved host https://$approvedDashboardHost/; pass -PbrokaAdminDashboardUrl=... or set it in android-wrapper/gradle.properties."
    }
    return try {
        val uri = URI(dashboardUrl)
        val host = uri.host?.lowercase()
        when {
            uri.scheme?.lowercase() != "https" || host.isNullOrEmpty() ->
                "brokaAdminDashboardUrl must be an absolute HTTPS URL, but was \"$dashboardUrl\"."
            host != approvedDashboardHost ->
                "brokaAdminDashboardUrl host \"$host\" is not the approved dashboard host https://$approvedDashboardHost/."
            else -> ""
        }
    } catch (e: IllegalArgumentException) {
        "brokaAdminDashboardUrl is not a parseable URL: \"$dashboardUrl\" (${e.cause?.message ?: e.message})."
    }
}

tasks.register("validateDashboardUrl") {
    doLast {
        val rejection = dashboardUrlRejectionReason()
        if (rejection.isNotEmpty()) {
            throw GradleException(rejection)
        }
    }
}

tasks.named("preBuild") {
    dependsOn("validateDashboardUrl")
}

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
