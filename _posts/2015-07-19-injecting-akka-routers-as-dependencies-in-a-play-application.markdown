---
layout: post
title:  "Injecting Akka Routers as Dependencies in a Play Application"
date:   2015-07-19 18:30:00
categories: scala playframework akka dependency-injection
---

Sometimes, an actor can't keep up with the amount of messages it receives. When work is produced at a faster rate than it can be consumed, the system is in trouble. A bounded mailbox will drop messages that were intended to the actor while an unbounded one will grow until it consumes all the available memory and crashes the application.

If the task being performed isn't CPU-bound or if there are enough cores available in the machine, a simple solution might be just have enough instances of this stressed actor working in parallel. [Akka](http://akka.io) helps us to implement this by providing [routers](http://doc.akka.io/docs/akka/snapshot/scala/routing.html): actors that proxy, [supervise](http://doc.akka.io/docs/akka/snapshot/scala/routing.html#Supervision) and delegate messages to the child actors it manages. That is, when a mensage is sent the the router, it will be forwarded to one of the managed actors so that it can be properly handled. For the producer originating the messages, nothing changes: it just needs an `ActorRef` to the router and it can be completely ignorant about the size of the pool of consumers and whether it is pushing work directly to the consumer or through an intermediate.

The problem, then, becomes a matter of providing such a reference to the producer. Since version 2.4, [Play Framework](https://www.playframework.com/) provides [out-of-the-box support for Dependency Injection](https://www.playframework.com/documentation/2.4.x/ScalaDependencyInjection), which also can be used to [build and inject actors](https://www.playframework.com/documentation/2.4.x/ScalaAkka#Dependency-injecting-actors) where they are needed. Here is a brief example:

{% highlight scala %}
class StressedActor @Inject() (dependencies...) extends Actor {
  override def receive = ...
}

class StressedActorModule extends AbstractModule with AkkaGuiceSupport {
  def configure() = {
    bindActor[StressedActor]("stressed-actor")
  }
}

class Producer @Inject() (@Named("stressed-actor") talkingActor: ActorRef) {
  ...
}

// Add the following line to application.conf:
play.modules.enabled+="path.to.StressedActorModule"
{% endhighlight %}

With as little boilerplate as this, Play will be able to build `StressedActor` (along with all its dependencies) and have it injected in `Producer`. At the present situation, though, this isn't sufficient as more than a single instance of the actor is demanded. Fortunately, only a small tweak at the module is needed to have a number of instances of `StressedActor` built under a router and to have this router injected into the producers:

{% highlight scala %}
class StressedActorModule extends AbstractModule with AkkaGuiceSupport {
  def configure() = {
    bindActor[StressedActor]("stressed-actor", RoundRobinPool(5).props)
  }
}
{% endhighlight %}

Here, a pool five consumers will be instantiated and the messages sent to the router will be conveniently delivered to these consumers in round-robin fashion such that the load on them is kept balanced.
