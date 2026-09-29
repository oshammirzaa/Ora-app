import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("keystore.properties")
if (!keystorePropertiesFile.exists()) {
    throw GradleException("android/keystore.properties is required to sign the Play release bundle.")
}
keystoreProperties.load(FileInputStream(keystorePropertiesFile))

android {
    namespace = "com.orapsychic.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.orapsychic.app"
        minSdk = 24
        targetSdk = 36
        // Increment versionCode for every Google Play upload.
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("release") {
            storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
            storePassword = keystoreProperties.getProperty("storePassword")
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isDebuggable = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        jniLibs {
            useLegacyPackaging = false
        }
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.2")
}
