///
/// HybridContactsModuleSpecSwift.hpp
/// This file was generated by nitrogen. DO NOT MODIFY THIS FILE.
/// https://github.com/mrousavy/nitro
/// Copyright © 2024 Marc Rousavy @ Margelo
///

#pragma once

#include "HybridContactsModuleSpec.hpp"

// Forward declaration of `HybridContactsModuleSpecCxx` to properly resolve imports.
namespace ContactsModule { class HybridContactsModuleSpecCxx; }

// Forward declaration of `Contact` to properly resolve imports.
namespace margelo::nitro::contacts { struct Contact; }
// Forward declaration of `StringHolder` to properly resolve imports.
namespace margelo::nitro::contacts { struct StringHolder; }
// Forward declaration of `ContactFields` to properly resolve imports.
namespace margelo::nitro::contacts { enum class ContactFields; }

#include <NitroModules/Promise.hpp>
#include <vector>
#include "Contact.hpp"
#include <optional>
#include <string>
#include "StringHolder.hpp"
#include "ContactFields.hpp"

#if __has_include(<NitroModules/HybridContext.hpp>)
#include <NitroModules/HybridContext.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include "ContactsModule-Swift-Cxx-Umbrella.hpp"

namespace margelo::nitro::contacts {

  /**
   * The C++ part of HybridContactsModuleSpecCxx.swift.
   *
   * HybridContactsModuleSpecSwift (C++) accesses HybridContactsModuleSpecCxx (Swift), and might
   * contain some additional bridging code for C++ <> Swift interop.
   *
   * Since this obviously introduces an overhead, I hope at some point in
   * the future, HybridContactsModuleSpecCxx can directly inherit from the C++ class HybridContactsModuleSpec
   * to simplify the whole structure and memory management.
   */
  class HybridContactsModuleSpecSwift: public virtual HybridContactsModuleSpec {
  public:
    // Constructor from a Swift instance
    explicit HybridContactsModuleSpecSwift(const ContactsModule::HybridContactsModuleSpecCxx& swiftPart):
      HybridObject(HybridContactsModuleSpec::TAG),
      _swiftPart(swiftPart) { }

  public:
    // Get the Swift part
    inline ContactsModule::HybridContactsModuleSpecCxx getSwiftPart() noexcept { return _swiftPart; }

  public:
    // Get memory pressure
    inline size_t getExternalMemorySize() noexcept override {
      return _swiftPart.getMemorySize();
    }

  public:
    // Properties
    

  public:
    // Methods
    inline std::shared_ptr<Promise<std::vector<Contact>>> getAll(const std::vector<ContactFields>& keys) override {
      auto __result = _swiftPart.getAll(keys);
      return __result;
    }

  private:
    ContactsModule::HybridContactsModuleSpecCxx _swiftPart;
  };

} // namespace margelo::nitro::contacts
