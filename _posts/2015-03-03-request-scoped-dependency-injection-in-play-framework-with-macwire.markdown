---
layout: post
title:  "Request-Scoped Dependency-Injection in Play Framework with MacWire"
date:   2015-03-03 09:00:00
categories: scala playframework dependency-injection macwire
---

Controllers in [Play Framework](https://www.playframework.com) are usually defined as singleton objects. In fact, Play's documentation defines a controller as [a singleton object that generates Action values](https://www.playframework.com/documentation/2.3.x/ScalaActions) and provides an example like the one below:

{% highlight scala %}
object Application extends Controller {
  def index = Action {
    Ok("It works!")
  }
}
{% endhighlight %}

This kind of design is not without problems. Any dependencies of these controllers must be constructed inside the controller, tightening the coupling between them as the controller must now concern itself with one more aspect of its dependencies, namely, their construction.

This increased coupling also make the reuse of these controllers harder as it's not trivial to tweak them by substituting their dependencies with different implementations. This is particularly relevant when writing unit tests as it's often very interesting to substitute dependencies for mock objects.

The lifecyle of the dependencies may also become a more present concern: if a dependency is kept as an instance attribute, any mutable state in it will be shared by other requests to this controller, which may be particularly unpleasant in a concurrent environment. Avoiding this requires building the dependency independently at every action where it's necessary.

## A better design

This said, all these problems can be solved by adopting a different design. Instead of using the same singleton object for handling every request, we can have an exclusive controller instance for each request. Instead of having all dependencies statically bound to the controller, we can have them injected in runtime into the controller through its constructor.

Even though Play provides no native support for [Dependency Injection](http://en.wikipedia.org/wiki/Dependency_injection), it allows us to take over the job of instantiating and providing the controller objects that will be used to handle the incoming requests. And since we can initialize these objects ourselves, we can also provide them their dependencies while we're at it. The approach we'll be using here is outlined in the [framework documentation](https://www.playframework.com/documentation/2.3.x/ScalaDependencyInjection), even though no specifics are given on how to perform the actual initializations and injections.

## Instantiating controllers manually

Consider a Play `routes` file with the following entry:

```
GET         /action                       controllers.Application.action
```

Any request to `/action` will be automatically dispatched by Play to the `action` method in the `Application` singleton object. However, if we prefix the route target with an `@` character, the method `getControllerInstance` in the `Global` object ([documentation](https://www.playframework.com/documentation/2.3.x/ScalaGlobal)) will be called to produce an instance of the `Application` class.

```
GET         /action                       @controllers.Application.action
```

The following snippet contains a trivial implementation for the `Global#getControllerInstance` method. It just produces a new instance of the given class. In fact, you don't actually need to implement it as `Global` will inherit the exact same implementation from the `GlobalSettings` superclass.

{% highlight scala %}
object Global extends GlobalSettings {
  override def getControllerInstance[A](controllerClass: Class[A]): A = {
    controllerClass.newInstance();
  }
}
{% endhighlight %}

Notice that it takes a class as argument, not a singleton object. And the return of this method will be an instance of the given class. Therefore, our controller cannot be a singleton object as it must be a class instead.

{% highlight scala %}
class Application extends Controller {
  def action = Action {
    Ok("It works!")
  }
}
{% endhighlight %}

## Introducing MacWire

[MacWire](https://github.com/adamw/macwire) is an interesting library for performing Dependency Injection in Scala applications. Like an usual DI container, it frees the developer from the tedious wiring of instances and dependencies. Unlike such containers, though, it generates all this wiring code in compile-time, backed by Scala macros. This way, if some class cannot be initialized because, say, some dependency isn't registered, a compilation error will be raised instead of a runtime error.

The library expects the managed classes to be registered as attributes in a `class`, `trait` or `object`.

{% highlight scala %}
class AuthenticationService
class Application(authenticationService: AuthenticationService) extends Controller

class Wiring {
  lazy val authenticationService = wire[AuthenticationService]
  lazy val application = wire[Application]
}
{% endhighlight %}

Fetching a perfectly wired instance with a static lookup is trivial:

{% highlight scala %}
val wiring = new Wiring()

wiring.application
{% endhighlight %}

In our case, however, a dynamic lookup will be necessary. MacWire makes this easy too:

{% highlight scala %}
val wiring = new Wiring()
val appClass = classOf[Application]

wiredInModule(wiring).lookupSingleOrThrow(appClass)
{% endhighlight %}

## Putting it all together

Finally, if we have a `Wiring` class such as the one described above, we simply have modify our `Global#getControllerInstance` method to use it when building our controller instances:

{% highlight scala %}
object Global extends GlobalSettings {
  override def getControllerInstance[A](controllerClass: Class[A]): A = {
    wiredInModule(new Wiring).lookupSingleOrThrow(controllerClass)
  }
}
{% endhighlight %}

Notice that we're building a new instance of `Wiring` at every request. This will ensure that the returned controller and its dependencies will all be scoped to a single request. Unnecessary components won't be constructed as long as they are registered in `lazy val` attributes.
