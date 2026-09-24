Pod::Spec.new do |s|
  s.name           = 'RoutyUIModifiers'
  s.version        = '1.0.0'
  s.summary        = 'Custom @expo/ui SwiftUI modifiers used by Routy'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = 'Routy'
  s.homepage       = 'https://github.com/expo/expo'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,mm,swift}"
end
